import { PRIORITY_FILTERS, PRIORITY_FILTERS_LIST } from '../utils/tasks.js'

export function PriorityFilters({ current, counts, onChange }) {
  const descriptionFor = {
    [PRIORITY_FILTERS.all]: 'tasks of any priority',
    [PRIORITY_FILTERS.low]: 'low priority tasks',
    [PRIORITY_FILTERS.medium]: 'medium priority tasks',
    [PRIORITY_FILTERS.high]: 'high priority tasks',
  }

  return (
    <div className="priority-filters" role="group" aria-label="Filter tasks by priority">
      {PRIORITY_FILTERS_LIST.map((filter) => {
        const isActive = current === filter.value

        return (
          <button
            key={filter.value}
            type="button"
            className={`priority-filters__button${isActive ? ' is-active' : ''}${
              filter.value !== PRIORITY_FILTERS.all
                ? ` priority-filters__button--${filter.value}`
                : ''
            }`}
            aria-pressed={isActive}
            onClick={() => onChange(filter.value)}
          >
            {filter.label}
            <span className="priority-filters__count">{counts[filter.value]}</span>
            <span className="visually-hidden"> {descriptionFor[filter.value]}</span>
          </button>
        )
      })}
    </div>
  )
}
