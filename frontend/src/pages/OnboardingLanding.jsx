import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, UserPlus, ArrowRight } from 'lucide-react';

const LandingCard = ({ title, description, icon, onClick, cta }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left group bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-7 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 hover:border-primary/30 hover:shadow-md dark:hover:border-primary/30 transition-all relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 dark:bg-primary/20 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-primary/20 border border-primary/20 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors">
              {title}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 transition-colors">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 text-sm font-semibold border border-gray-200 dark:border-gray-700 transition-colors group-hover:bg-primary/10 group-hover:border-primary/30">
            {cta}
          </span>
          <ArrowRight className="w-5 h-5 text-primary opacity-90 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  );
};

const OnboardingLanding = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in transition-colors duration-300">
      <div className="bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/10 dark:bg-primary/20 rounded-full blur-[70px] transition-all" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight transition-colors">
            Community Connect
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 transition-colors">
            Create or join your society to start tracking and resolving complaints.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LandingCard
          title="Create Community"
          description="Set up your society and start inviting residents."
          icon={<Building2 className="w-6 h-6 text-primary" />}
          cta="Get Started"
          onClick={() => navigate('/onboarding/create-community')}
        />

        <LandingCard
          title="Join Existing Community"
          description="Search and request access to your society."
          icon={<UserPlus className="w-6 h-6 text-primary" />}
          cta="Join Now"
          onClick={() => navigate('/onboarding/join-community')}
        />
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-sm font-semibold text-primary hover:text-primary-dark hover:underline transition-colors"
        >
          Already have an account? Go to Login
        </button>
      </div>
    </div>
  );
};

export default OnboardingLanding;
