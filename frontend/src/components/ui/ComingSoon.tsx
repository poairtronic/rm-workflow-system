import { Hammer } from 'lucide-react';

interface ComingSoonProps {
  title?: string;
}

export function ComingSoon({ title = 'Coming Soon' }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Hammer className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500 max-w-md">
        This feature is currently under development. Please check back later.
      </p>
    </div>
  );
}
