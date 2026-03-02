import React from "react";
import { ArrowUpDown, BellRing, CalendarDays, Image, LayoutList, Search, Tag } from "lucide-react";

const TYPE_OPTIONS = [
  { label: "All", value: "all", icon: <LayoutList size={14} /> },
  { label: "Updates", value: "update", icon: <BellRing size={14} /> },
  { label: "Events", value: "event", icon: <CalendarDays size={14} /> },
  { label: "Polls", value: "poll", icon: <ArrowUpDown size={14} /> },
  { label: "Media", value: "media", icon: <Image size={14} /> },
];

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
  { label: "Most Reacted", value: "reacted" },
];

export default function FilterBar({
  filter,
  search,
  sortBy,
  selectedTag,
  tags,
  onFilterChange,
  onSearchChange,
  onSortChange,
  onTagChange,
}) {
  return (
    <div className="community-filter-bar">
      <div className="community-filter-row">
        <div className="community-search-wrap">
          <Search size={16} />
          <input
            type="text"
            value={search}
            className="community-search-input"
            placeholder="Search posts, events, polls..."
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="community-sort-wrap">
          <Tag size={14} />
          <label htmlFor="community-tag">Tag</label>
          <select id="community-tag" value={selectedTag} onChange={(e) => onTagChange(e.target.value)}>
            <option value="all">All Tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="community-filter-row">
        <div className="community-filter-pills">
          {TYPE_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`community-pill ${filter === item.value ? "active" : ""}`}
              onClick={() => onFilterChange(item.value)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="community-sort-wrap">
          <ArrowUpDown size={14} />
          <label htmlFor="community-sort">Sort</label>
          <select id="community-sort" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            {SORT_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
