import React, { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  icon: ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ title, icon }) => {
  return (
    <div className="flex items-center mb-8">
      <div className="mr-4 w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/20">
        <div className="text-purple-300">
          {icon}
        </div>
      </div>
      <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
        {title}
      </h2>
    </div>
  );
};

export default SectionHeader;