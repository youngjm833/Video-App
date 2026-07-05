import { CATEGORIES, type CategoryFilterValue } from '../types'

interface CategoryFilterProps {
  selected: CategoryFilterValue
  onSelect: (category: CategoryFilterValue) => void
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <nav className="category-filter" aria-label="Video categories">
      {CATEGORIES.map((category) => (
        <button
          key={category}
          className={`category-filter__chip${
            selected === category ? ' category-filter__chip--active' : ''
          }`}
          onClick={() => onSelect(category)}
        >
          {category}
        </button>
      ))}
    </nav>
  )
}
