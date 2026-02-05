import React from 'react';

// Categories ordered: genres first, then regions
const mainCategories = ['All', 'Music', 'Comedy', 'African', 'European', 'American', 'Asian', 'Maghreb'];

interface CategoryFilterProps {
  categories: any[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
  categories,
  activeCategory, 
  onCategoryChange 
}) => {
  // Use provided categories if available, otherwise fall back to mainCategories
  const displayCategories = categories && categories.length > 0 
    ? ['all', ...categories.filter(c => c !== 'all')]
    : mainCategories.map(c => c === 'All' ? 'all' : c.toLowerCase());

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      {displayCategories.map((category) => {
        const categoryLabel = category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1);
        const isActive = activeCategory === category;
        return (
          <button
            key={category}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
              isActive
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 scale-105'
                : 'bg-white/5 backdrop-blur-sm text-gray-300 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 hover:text-white'
            }`}
            onClick={() => onCategoryChange(category)}
          >
            {categoryLabel}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;