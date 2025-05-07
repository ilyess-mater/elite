import React, { useRef, useEffect } from "react";
import "../styles/category-manager.css";

const CategoryDropdown = ({
  isOpen,
  onClose,
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close dropdown when ESC key is pressed
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="category-dropdown-menu"
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="category-dropdown-header">
        <h4>Select Category</h4>
        <button className="category-dropdown-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="category-dropdown-items">
        <div
          className={`category-dropdown-item ${
            !selectedCategoryId ? "active" : ""
          }`}
          onClick={() => {
            onSelectCategory(null);
            onClose();
          }}
        >
          <span className="category-dropdown-name">No Category</span>
        </div>

        {categories.map((category) => (
          <div
            key={category.id}
            className={`category-dropdown-item ${
              selectedCategoryId === category.id ? "active" : ""
            }`}
            onClick={() => {
              onSelectCategory(category.id);
              onClose();
            }}
          >
            <div
              className="category-dropdown-color"
              style={{ backgroundColor: category.color }}
            ></div>
            <span className="category-dropdown-name">{category.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryDropdown;
