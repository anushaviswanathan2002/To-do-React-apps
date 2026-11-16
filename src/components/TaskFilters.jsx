import { FILTERS_LIST } from '../utils/tasks.js'

export function TaskFilters({ current, counts, onChange }) {
  const labelFor = {
    [FILTERS_LIST[0].value]: 'all tasks',
    [FILTERS_LIST[1].value]: 'active tasks',
    [FILTERS_LIST[2].value]: 'completed tasks',
  }

  return (
    <div className="filters" role="group" aria-label="Filter tasks">
      {FILTERS_LIST.map((filter) => {
        const count =
          filter.value === 'all'
            ? counts.total
            : filter.value === 'active'
              ? counts.active
              : counts.completed

        return (
          <button
            key={filter.value}
            type="button"
            className={`filters__button${current === filter.value ? ' is-active' : ''}`}
            aria-pressed={current === filter.value}
            onClick={() => onChange(filter.value)}
          >
            {filter.label}
            <span className="filters__count">{count}</span>
            <span className="visually-hidden"> {labelFor[filter.value]}</span>
          </button>
        )
      })}
    </div>
  )
}
