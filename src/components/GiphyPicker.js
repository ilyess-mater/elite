import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/giphy-picker.css";

function GiphyPicker({ onGifSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trending, setTrending] = useState(true);
  const searchInputRef = useRef(null);

  // Giphy API key - in a production app, this should be stored in an environment variable
  const GIPHY_API_KEY = "5SbK8MVdLKx8E9wEZnKZa0hrNa4yueAy";

  // Focus the search input when component mounts and set up search effect
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    // Load trending GIFs on initial render
    fetchTrendingGifs();
  }, []);

  // Effect to search GIFs when searchTerm changes
  useEffect(() => {
    // Create a debounce timer to avoid too many API calls
    const debounceTimer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchGifs();
      }
    }, 500); // Wait 500ms after user stops typing

    // Clean up the timer
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // Fetch trending GIFs from Giphy API
  const fetchTrendingGifs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
      );
      setGifs(response.data.data);
      setTrending(true);
    } catch (err) {
      console.error("Error fetching trending GIFs:", err);
      setError("Failed to load trending GIFs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Search GIFs based on user input
  const searchGifs = async () => {
    if (!searchTerm.trim()) {
      fetchTrendingGifs();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
          searchTerm
        )}&limit=20&rating=g`
      );
      setGifs(response.data.data);
      setTrending(false);
    } catch (err) {
      console.error("Error searching GIFs:", err);
      setError("Failed to search GIFs. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle GIF selection
  const handleGifClick = (gif) => {
    onGifSelect({
      url: gif.images.fixed_height.url,
      id: gif.id,
      title: gif.title,
      type: "gif",
    });
    onClose();
  };

  return (
    <div className="giphy-picker-container">
      <div className="giphy-picker-header">
        <h3>
          <i className="fas fa-images"></i>
          {trending ? "Trending GIFs" : "Search Results"}
        </h3>
        <button className="giphy-close-button" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="giphy-search-form">
        <input
          type="text"
          ref={searchInputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search for GIFs..."
          className="giphy-search-input"
        />
        <span className="giphy-search-icon">
          <i className="fas fa-search"></i>
        </span>
      </div>

      {error && <div className="giphy-error">{error}</div>}

      <div className="giphy-results">
        {loading ? (
          <div className="giphy-loading">
            <i className="fas fa-spinner fa-spin"></i> Loading...
          </div>
        ) : gifs.length > 0 ? (
          <div className="giphy-grid">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                className="giphy-item"
                onClick={() => handleGifClick(gif)}
              >
                <img
                  src={gif.images.fixed_height_small.url}
                  alt={gif.title}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="giphy-no-results">
            No GIFs found. Try a different search term.
          </div>
        )}
      </div>

      <div className="giphy-footer">
        <div className="giphy-attribution">
          Powered by <span className="giphy-logo">GIPHY</span>
        </div>
      </div>
    </div>
  );
}

export default GiphyPicker;
