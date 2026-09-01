import { Link } from "react-router-dom";

export default function ClassList({ classes, onDelete }) {
  if (!classes.length) {
    return <p className="empty-state">No classes yet. Create one to begin.</p>;
  }

  return (
    <div className="item-grid">
      {classes.map((item) => (
        <div className="flat-card action-card" key={item.id}>
          <Link className="flat-card-main" to={`/class/${item.id}`}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.description || "No description"}</p>
            </div>
          </Link>
          <button
            className="delete-icon-button"
            type="button"
            aria-label={`Delete class ${item.name}`}
            title="Delete class"
            onClick={() => onDelete?.(item)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
