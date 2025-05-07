import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/category-manager.css";

const CategoryManager = ({ onClose, onCategoryChange }) => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: "", color: "#4A76A8" });
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Predefined colors for categories
  const colorOptions = [
    "#4A76A8", // Blue
    "#55A55A", // Green
    "#E64C3C", // Red
    "#F39C12", // Orange
    "#9B59B6", // Purple
    "#1ABC9C", // Teal
    "#34495E", // Dark Blue
    "#7F8C8D", // Gray
  ];

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/categories", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setCategories(response.data);
      setError("");
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError("Failed to load categories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategory.name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      const response = await axios.post(
        "/api/categories",
        {
          name: newCategory.name,
          color: newCategory.color,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Add new category to the list
      setCategories([...categories, response.data]);
      
      // Reset form
      setNewCategory({ name: "", color: "#4A76A8" });
      setError("");
      
      // Notify parent component
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error("Error creating category:", err);
      setError(
        err.response?.data?.error || "Failed to create category. Please try again."
      );
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      const response = await axios.put(
        `/api/categories/${editingCategory.id}`,
        {
          name: editingCategory.name,
          color: editingCategory.color,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Update category in the list
      setCategories(
        categories.map((cat) =>
          cat.id === editingCategory.id ? response.data : cat
        )
      );
      
      // Reset editing state
      setEditingCategory(null);
      setError("");
      
      // Notify parent component
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error("Error updating category:", err);
      setError(
        err.response?.data?.error || "Failed to update category. Please try again."
      );
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm("Are you sure you want to delete this category?")) {
      return;
    }

    try {
      await axios.delete(`/api/categories/${categoryId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // Remove category from the list
      setCategories(categories.filter((cat) => cat.id !== categoryId));
      
      // Reset editing state if deleting the category being edited
      if (editingCategory && editingCategory.id === categoryId) {
        setEditingCategory(null);
      }
      
      // Notify parent component
      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (err) {
      console.error("Error deleting category:", err);
      setError(
        err.response?.data?.error || "Failed to delete category. Please try again."
      );
    }
  };

  const startEditing = (category) => {
    setEditingCategory({ ...category });
    setError("");
  };

  const cancelEditing = () => {
    setEditingCategory(null);
    setError("");
  };

  return (
    <div className="category-manager">
      <div className="category-manager-header">
        <h2>Manage Categories</h2>
        <button className="close-button" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="category-form-container">
        {editingCategory ? (
          <form className="category-form" onSubmit={handleUpdateCategory}>
            <h3>Edit Category</h3>
            <div className="form-group">
              <label>Category Name</label>
              <input
                type="text"
                value={editingCategory.name}
                onChange={(e) =>
                  setEditingCategory({
                    ...editingCategory,
                    name: e.target.value,
                  })
                }
                placeholder="Enter category name"
                required
              />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker">
                {colorOptions.map((color) => (
                  <div
                    key={color}
                    className={`color-option ${
                      editingCategory.color === color ? "selected" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() =>
                      setEditingCategory({ ...editingCategory, color })
                    }
                  ></div>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Update Category
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form className="category-form" onSubmit={handleCreateCategory}>
            <h3>Create New Category</h3>
            <div className="form-group">
              <label>Category Name</label>
              <input
                type="text"
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
                placeholder="Enter category name"
                required
              />
            </div>
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker">
                {colorOptions.map((color) => (
                  <div
                    key={color}
                    className={`color-option ${
                      newCategory.color === color ? "selected" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategory({ ...newCategory, color })}
                  ></div>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create Category
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="categories-list">
        <h3>Your Categories</h3>
        {loading ? (
          <div className="loading">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="no-categories">
            No categories yet. Create your first category above.
          </div>
        ) : (
          <ul>
            {categories.map((category) => (
              <li key={category.id} className="category-item">
                <div className="category-info">
                  <div
                    className="category-color"
                    style={{ backgroundColor: category.color }}
                  ></div>
                  <span className="category-name">{category.name}</span>
                </div>
                <div className="category-actions">
                  <button
                    className="edit-button"
                    onClick={() => startEditing(category)}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteCategory(category.id)}
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
