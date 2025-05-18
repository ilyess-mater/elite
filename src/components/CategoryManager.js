import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/category-manager.css";

const CategoryManager = ({ onClose, onCategoryChange }) => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "#4A76A8",
  });
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

      // Get removed chats from localStorage
      const removedChats = JSON.parse(
        localStorage.getItem("removedChats") || "[]"
      );

      // Get all contacts to determine active departments
      const contactsResponse = await axios.get("/api/contacts", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // Filter out contacts with removed chats
      const activeContacts = contactsResponse.data.filter(
        (contact) => !removedChats.includes(contact.id)
      );

      // Get all departments from active contacts
      const activeDepartments = new Set();
      activeContacts.forEach((contact) => {
        if (contact.department) {
          activeDepartments.add(contact.department);
        }
      });

      console.log(
        "Active departments in CategoryManager:",
        Array.from(activeDepartments)
      );

      // Fetch categories
      const response = await axios.get("/api/categories", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      // Filter out department categories that don't have active contacts
      const filteredCategories = response.data.filter((category) => {
        // Keep non-department categories
        if (!category.isDepartmentCategory) return true;

        // Only keep department categories that have active contacts
        return activeDepartments.has(category.name);
      });

      console.log(
        "Filtered categories in CategoryManager:",
        filteredCategories
      );
      setCategories(filteredCategories);
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

      // Fetch all categories again to ensure proper filtering
      await fetchCategories();

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
        err.response?.data?.error ||
          "Failed to create category. Please try again."
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
      await axios.put(
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

      // Fetch all categories again to ensure proper filtering
      await fetchCategories();

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
        err.response?.data?.error ||
          "Failed to update category. Please try again."
      );
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleteAll, setIsDeleteAll] = useState(false);

  const confirmDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setIsDeleteAll(false);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAllCategories = () => {
    setIsDeleteAll(true);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCategory = async () => {
    try {
      if (isDeleteAll) {
        // Delete all user-created categories
        const userCategories = categories.filter(
          (cat) => !cat.isDepartmentCategory
        );

        // Use Promise.all to delete all categories in parallel
        await Promise.all(
          userCategories.map((category) =>
            axios.delete(`/api/categories/${category.id}`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            })
          )
        );

        // Fetch all categories again to ensure proper filtering
        await fetchCategories();

        // Reset editing state
        setEditingCategory(null);
      } else if (categoryToDelete) {
        // Delete single category
        await axios.delete(`/api/categories/${categoryToDelete.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        // Fetch all categories again to ensure proper filtering
        await fetchCategories();

        // Reset editing state if deleting the category being edited
        if (editingCategory && editingCategory.id === categoryToDelete.id) {
          setEditingCategory(null);
        }
      }

      // Notify parent component
      if (onCategoryChange) {
        onCategoryChange();
      }

      // Close the confirmation modal
      setShowDeleteConfirm(false);
      setCategoryToDelete(null);
      setIsDeleteAll(false);
    } catch (err) {
      console.error("Error deleting category:", err);
      setError(
        err.response?.data?.error ||
          "Failed to delete category. Please try again."
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
        <div className="categories-list-header">
          <h3>Your Categories</h3>
          {categories.filter((cat) => !cat.isDepartmentCategory).length > 0 && (
            <button
              className="delete-all-button"
              onClick={confirmDeleteAllCategories}
              title="Delete all categories"
            >
              <i className="fas fa-trash-alt"></i> Delete All
            </button>
          )}
        </div>
        {loading ? (
          <div className="loading">Loading categories...</div>
        ) : categories.filter((cat) => !cat.isDepartmentCategory).length ===
          0 ? (
          <div className="no-categories">
            No categories yet. Create your first category above.
          </div>
        ) : (
          <ul>
            {categories
              .filter((category) => !category.isDepartmentCategory)
              .map((category) => (
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
                      className="edit-button modern-icon-btn"
                      onClick={() => startEditing(category)}
                      title="Edit category"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className="delete-button modern-icon-btn"
                      onClick={() => confirmDeleteCategory(category)}
                      title="Delete category"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <div className="confirm-dialog-header">
              <h3>
                {isDeleteAll ? "Delete All Categories" : "Delete Category"}
              </h3>
            </div>
            <div className="confirm-dialog-content">
              {isDeleteAll ? (
                <p>
                  Are you sure you want to delete <strong>all</strong> your
                  custom categories?
                  <br />
                  This action cannot be undone.
                </p>
              ) : (
                <p>
                  Are you sure you want to delete the category "
                  {categoryToDelete?.name}"?
                  <br />
                  This action cannot be undone.
                </p>
              )}
            </div>
            <div className="confirm-dialog-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCategoryToDelete(null);
                  setIsDeleteAll(false);
                }}
              >
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDeleteCategory}>
                {isDeleteAll ? "Delete All" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
