import React from "react";
import PropTypes from "prop-types";

const SearchBar = ({
  placeholder,
  value,
  onChange,
  onSearch,
  icon = "search",
  className = "",
  autoFocus = false,
  clearable = true,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleClear = () => {
    onChange("");
  };

  return (
    <form onSubmit={handleSubmit} className={`search-bar-wrapper ${className}`}>
      <div className="search-bar">
        <i className={`fas fa-${icon}`}></i>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {clearable && value && (
          <button
            type="button"
            className="clear-button"
            onClick={handleClear}
            aria-label="Effacer la recherche"
          >
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>
    </form>
  );
};

SearchBar.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSearch: PropTypes.func,
  icon: PropTypes.string,
  className: PropTypes.string,
  autoFocus: PropTypes.bool,
  clearable: PropTypes.bool,
};

export default SearchBar;
