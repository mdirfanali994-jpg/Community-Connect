const Event = require('../models/Event');
const EventRSVP = require('../models/EventRSVP');
const {
  EVENT_CATEGORY_KEYS,
  EVENT_STATUSES,
  RSVP_STATUSES,
} = require('../constants/eventConstants');
const {
  setIO,
  emitTo,
  createAndEmitNotification,
  emitChannelEvent,
  writeAuditLog,
  extractRequestContext,
  deriveAdmin,
  deriveResident,
  isValidObjectId,
} = require('../services/communityService');

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function generateCheckInCode(eventId, residentId) {
  const raw = `${String(eventId)}-${String(residentId)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `EV-${hash.toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Compute effective event status based on date/time.
 */
function effectiveStatus(event) {
  const now = new Date();
  if (event.status === 'cancelled') return 'cancelled';
  if (event.status === 'draft') return 'draft';
  const start = new Date(event.date);
  const end = new Date(start.getTime() + (event.durationHours || 3) * 60 * 60 * 1000);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'ongoing';
  return 'completed';
}

async function refreshEventStatus(event) {
  const status = effectiveStatus(event);
  if (status !== event.status) {
    return Event.findByIdAndUpdate(event._id, { $set: { status } }, { new: true, lean: true }) || event;
  }
  return event;
}

async function refreshMany(events) {
  const results = [];
  for (const e of events) results.push(await refreshEventStatus(e));
  return results;
}

/**
 * Enrich an event with RSVP counts and (optionally) the resident's RSVP.
 */
async function enrichEvent(event, residentId = null) {
  const going = await EventRSVP.countDocuments({ eventId: event._id, status: 'going' });
  const maybe = await EventRSVP.countDocuments({ eventId: event._id, status: 'maybe' });
  const notGoing = await EventRSVP.countDocuments({ eventId: event._id, status: 'not_going' });
  const checkedIn = await EventRSVP.countDocuments({ eventId: event._id, checkedIn: true });

  let myRsvp = null;
  if (residentId) {
    const r = await EventRSVP.findOne({ eventId: event._id, residentId }).lean();
    myRsvp = r ? r.status : null;
  }

  return {
    ...event,
    going,
    maybe,
    notGoing,
    checkedIn,
    totalResponded: going + maybe + notGoing,
    spotsLeft: event.maxParticipants > 0 ? Math.max(0, event.maxParticipants - going) : null,
    myRsvp,
  };
}

/* ─── Admin Endpoints ─────────────────────────────────────────────────────── */

/**
 * Admin creates an event.
 * POST /api/events
 * Body: { title, description, category, date, time, venue, organizer, maxParticipants, status }
 * Optional multipart: banner, image
 */
const createEvent = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { title, description, category, date, time, venue, organizer, maxParticipants, status } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    if (category && !EVENT_CATEGORY_KEYS.includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    if (status && !EVENT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const banner = req.files?.banner?.[0]?.filename || null;
    const image = req.files?.image?.[0]?.filename || null;

    const event = await Event.create({
      communityId,
      category: category || 'other',
      title: String(title).trim(),
      description: description || '',
      banner,
      image,
      date: new Date(date),
      time: time || '',
      venue: venue || '',
      organizer: organizer || '',
      maxParticipants: maxParticipants ? Number(maxParticipants) : 0,
      status: status || 'upcoming',
      createdBy: admin._id,
      updatedBy: admin._id,
    });

    const refreshed = await refreshEventStatus(event);
    const enriched = await enrichEvent(refreshed);

    // Notify residents
    await createAndEmitNotification({
      title: '🎉 New Event',
      message: enriched.title,
      type: 'EVENT_NEW',
      targetRole: 'resident',
      communityId,
      entityType: 'event',
      entityId: String(enriched._id),
      action: 'event_created',
      metadata: { category: enriched.category, date: enriched.date, venue: enriched.venue },
    });

    emitChannelEvent(`resident:${communityId}`, 'event:new', enriched);
    emitChannelEvent(`admin:${communityId}`, 'event:new', enriched);

    await writeAuditLog({
      communityId,
      entityType: 'event',
      entityId: String(enriched._id),
      action: 'create',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: enriched.title, category: enriched.category },
    });

    return res.status(201).json({ success: true, event: enriched });
  } catch (err) {
    console.error('createEvent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin lists events.
 * GET /api/events/admin?status=&category=&search=
 */
const listAdminEvents = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { status, category, search } = req.query;
    const query = { communityId };

    if (status && status !== 'all' && EVENT_STATUSES.includes(status)) query.status = status;
    if (category && category !== 'all' && EVENT_CATEGORY_KEYS.includes(category)) query.category = category;
    if (search) {
      const regex = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { description: regex }, { venue: regex }];
    }

    let events = await Event.find(query).sort({ date: -1 }).limit(500).lean();
    events = await refreshMany(events);

    const enriched = [];
    for (const e of events) enriched.push(await enrichEvent(e));

    return res.json({ success: true, events: enriched });
  } catch (err) {
    console.error('listAdminEvents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin updates an event.
 * PUT /api/events/:id
 */
const updateEvent = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid event id' });

    const existing = await Event.findOne({ _id: id, communityId }).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Event not found' });

    const { title, description, category, date, time, venue, organizer, maxParticipants, status } = req.body;
    const update = { updatedBy: admin._id };

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(400).json({ success: false, message: 'Title is required' });
      update.title = String(title).trim();
    }
    if (description !== undefined) update.description = description;
    if (category !== undefined) {
      if (!EVENT_CATEGORY_KEYS.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category' });
      update.category = category;
    }
    if (date !== undefined) update.date = new Date(date);
    if (time !== undefined) update.time = time;
    if (venue !== undefined) update.venue = venue;
    if (organizer !== undefined) update.organizer = organizer;
    if (maxParticipants !== undefined) update.maxParticipants = Number(maxParticipants) || 0;
    if (status !== undefined) {
      if (!EVENT_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
      update.status = status;
    }
    if (req.files?.banner?.[0]) update.banner = req.files.banner[0].filename;
    if (req.files?.image?.[0]) update.image = req.files.image[0].filename;

    const updated = await Event.findOneAndUpdate(
      { _id: id, communityId },
      { $set: update },
      { new: true, lean: true }
    );

    const refreshed = await refreshEventStatus(updated);
    const enriched = await enrichEvent(refreshed);

    emitChannelEvent(`resident:${communityId}`, 'event:updated', enriched);
    emitChannelEvent(`admin:${communityId}`, 'event:updated', enriched);

    await writeAuditLog({
      communityId,
      entityType: 'event',
      entityId: String(enriched._id),
      action: 'update',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: enriched.title },
    });

    return res.json({ success: true, event: enriched });
  } catch (err) {
    console.error('updateEvent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin deletes an event.
 * DELETE /api/events/:id
 */
const deleteEvent = async (req, res) => {
  try {
    const { communityId, admin, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid event id' });

    const deleted = await Event.findOneAndDelete({ _id: id, communityId }).lean();
    if (!deleted) return res.status(404).json({ success: false, message: 'Event not found' });

    await EventRSVP.deleteMany({ eventId: id, communityId });

    emitChannelEvent(`resident:${communityId}`, 'event:deleted', { id });
    emitChannelEvent(`admin:${communityId}`, 'event:deleted', { id });

    await writeAuditLog({
      communityId,
      entityType: 'event',
      entityId: id,
      action: 'delete',
      actor: admin.fullName || admin.email,
      actorUserId: admin._id,
      actorRole: 'admin',
      ...extractRequestContext(req),
      metadata: { title: deleted.title },
    });

    return res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    console.error('deleteEvent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin lists RSVP attendees for an event.
 * GET /api/events/:id/rsvps
 */
const listEventRsvps = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid event id' });

    const event = await Event.findOne({ _id: id, communityId }).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const rsvps = await EventRSVP.find({ eventId: id, communityId })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ success: true, rsvps });
  } catch (err) {
    console.error('listEventRsvps error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin gets event analytics.
 * GET /api/events/analytics
 */
const getEventAnalytics = async (req, res) => {
  try {
    const { communityId, error } = await deriveAdmin(req);
    if (error) return res.status(403).json({ success: false, message: error });

    let events = await Event.find({ communityId }).lean();
    events = await refreshMany(events);

    const categoryBreakdown = {};
let totalGoing = 0;
    let totalMaybe = 0;
    let totalNotGoing = 0;
    let totalCheckedIn = 0;
    let upcoming = 0;
    let ongoing = 0;
    let completed = 0;

    events.forEach((e) => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
      if (e.status === 'upcoming') upcoming += 1;
      if (e.status === 'ongoing') ongoing += 1;
      if (e.status === 'completed') completed += 1;
    });

    const rsvpStats = await EventRSVP.aggregate([
      { $match: { communityId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    rsvpStats.forEach((r) => {
      if (r._id === 'going') totalGoing = r.count;
      if (r._id === 'maybe') totalMaybe = r.count;
      if (r._id === 'not_going') totalNotGoing = r.count;
    });

    const checkedInAgg = await EventRSVP.countDocuments({ communityId, checkedIn: true });
    totalCheckedIn = checkedInAgg;

    return res.json({
      success: true,
      analytics: {
        total: events.length,
        upcoming,
        ongoing,
        completed,
        totalGoing,
        totalMaybe,
        totalCheckedIn,
        categoryBreakdown,
      },
    });
  } catch (err) {
    console.error('getEventAnalytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ─── Resident Endpoints ──────────────────────────────────────────────────── */

/**
 * Resident lists events (upcoming + past).
 * GET /api/events?userId=xxx&scope=upcoming|past|all&category=
 */
const getResidentEvents = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { scope, category } = req.query;
    const query = { communityId: resident.communityId, status: { $ne: 'draft' } };

    if (category && category !== 'all' && EVENT_CATEGORY_KEYS.includes(category)) query.category = category;

    let events = await Event.find(query).sort({ date: 1 }).limit(200).lean();
    events = await refreshMany(events);

    const now = new Date();
    let filtered = events;
    if (scope === 'upcoming') filtered = events.filter((e) => new Date(e.date) >= now && e.status !== 'cancelled');
    else if (scope === 'past') filtered = events.filter((e) => new Date(e.date) < now || e.status === 'completed');

    const enriched = [];
    for (const e of filtered) enriched.push(await enrichEvent(e, resident.residentId));

    return res.json({ success: true, events: enriched });
  } catch (err) {
    console.error('getResidentEvents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident RSVPs to an event.
 * PUT /api/events/:id/rsvp
 * Body: { userId, status }
 */
const rsvpEvent = async (req, res) => {
  try {
    const resident = await deriveResident(req.body.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    const { status } = req.body;
    if (!RSVP_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be going, maybe or not_going' });
    }
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid event id' });

    const event = await Event.findOne({ _id: id, communityId: resident.communityId, status: { $ne: 'cancelled' } }).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Capacity check for 'going'
    if (status === 'going' && event.maxParticipants > 0) {
      const going = await EventRSVP.countDocuments({ eventId: id, status: 'going' });
      if (going >= event.maxParticipants) {
        return res.status(403).json({ success: false, message: 'Event is full. No more spots available.' });
      }
    }

    let checkInCode = null;
    if (status === 'going') checkInCode = generateCheckInCode(id, resident.residentId);

    const rsvp = await EventRSVP.findOneAndUpdate(
      { eventId: id, residentId: resident.residentId, communityId: resident.communityId },
      {
        $set: {
          status,
          residentName: resident.fullName,
          block: resident.block,
          flatNumber: resident.flatNumber,
          updatedAt: new Date(),
          ...(checkInCode ? { checkInCode } : {}),
        },
        $setOnInsert: {
          communityId: resident.communityId,
          eventId: id,
          residentId: resident.residentId,
          createdAt: new Date(),
        },
      },
      { new: true, upsert: true, lean: true }
    );

    emitChannelEvent(`resident:${resident.communityId}`, 'event:rsvp', { eventId: id, status, residentName: resident.fullName });
    emitChannelEvent(`admin:${resident.communityId}`, 'event:rsvp', { eventId: id, status, residentName: resident.fullName });

    await writeAuditLog({
      communityId: resident.communityId,
      entityType: 'event',
      entityId: id,
      action: 'rsvp',
      actor: resident.fullName,
      actorUserId: resident.residentId,
      actorRole: 'resident',
      ...extractRequestContext(req),
      metadata: { title: event.title, status },
    });

    // Notify admin of new registration
    if (status === 'going') {
      await createAndEmitNotification({
        title: 'Event Registration',
        message: `${resident.fullName} (${resident.block}-${resident.flatNumber}) is going to ${event.title}`,
        type: 'EVENT_RSVP',
        targetRole: 'admin',
        communityId: resident.communityId,
        entityType: 'event',
        entityId: id,
        action: 'event_rsvp_going',
        metadata: { title: event.title, status },
      });
    }

    return res.json({ success: true, rsvp });
  } catch (err) {
    console.error('rsvpEvent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident views a single event.
 * GET /api/events/:id?userId=xxx
 */
const getEvent = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid event id' });

    let event = await Event.findOne({ _id: id, communityId: resident.communityId }).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    event = await refreshEventStatus(event);

    const going = await EventRSVP.find({ eventId: id, status: 'going' })
      .select({ residentName: 1, block: 1, flatNumber: 1, checkedIn: 1 })
      .lean();

    const enriched = await enrichEvent(event, resident.residentId);
    enriched.attendees = going;

    return res.json({ success: true, event: enriched });
  } catch (err) {
    console.error('getEvent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Resident QR check-in code for an event.
 * GET /api/events/:id/checkin?userId=xxx
 */
const getEventCheckIn = async (req, res) => {
  try {
    const resident = await deriveResident(req.query.userId);
    if (!resident) return res.status(403).json({ success: false, message: 'Forbidden: community isolation' });

    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid event id' });

    const rsvp = await EventRSVP.findOne({
      eventId: id,
      residentId: resident.residentId,
      communityId: resident.communityId,
      status: 'going',
    }).lean();

    if (!rsvp) return res.status(404).json({ success: false, message: 'You need to RSVP as Going first' });

    let code = rsvp.checkInCode;
    if (!code) {
      code = generateCheckInCode(id, resident.residentId);
      await EventRSVP.updateOne({ _id: rsvp._id }, { $set: { checkInCode: code } });
    }

    return res.json({ success: true, checkInCode: code, checkedIn: rsvp.checkedIn });
  } catch (err) {
    console.error('getEventCheckIn error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Admin/Security validates a check-in code.
 * POST /api/events/checkin
 * Body: { code, communityId }
 */
const validateCheckIn = async (req, res) => {
  try {
    const { code, communityId } = req.body;
    if (!code || !communityId) {
      return res.status(400).json({ success: false, message: 'code and communityId are required' });
    }

    const rsvp = await EventRSVP.findOne({ checkInCode: code, communityId }).lean();
    if (!rsvp) return res.status(404).json({ success: false, message: 'Invalid check-in code' });

    if (rsvp.checkedIn) {
      return res.json({ success: true, alreadyCheckedIn: true, rsvp });
    }

    const updated = await EventRSVP.findOneAndUpdate(
      { _id: rsvp._id },
      { $set: { checkedIn: true, checkedInAt: new Date() } },
      { new: true, lean: true }
    );

    const event = await Event.findOne({ _id: rsvp.eventId, communityId }).lean();

    await writeAuditLog({
      communityId,
      entityType: 'event',
      entityId: rsvp.eventId,
      action: 'checkin',
      actor: updated.residentName,
      actorRole: 'resident',
      ...extractRequestContext(req),
      metadata: { eventTitle: event?.title || '', residentName: updated.residentName },
    });

    emitChannelEvent(`admin:${communityId}`, 'event:checkin', { eventId: rsvp.eventId, residentName: updated.residentName });

    return res.json({ success: true, alreadyCheckedIn: false, rsvp: updated });
  } catch (err) {
    console.error('validateCheckIn error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  setIO,
  // Admin
  createEvent,
  listAdminEvents,
  updateEvent,
  deleteEvent,
  listEventRsvps,
  getEventAnalytics,
  // Resident
  getResidentEvents,
  rsvpEvent,
  getEvent,
  getEventCheckIn,
  validateCheckIn,
  // helpers
  refreshEventStatus,
  effectiveStatus,
  emitTo,
};
