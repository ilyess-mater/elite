import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import "../styles/urgency-selector.css";

/**
 * UrgencySelector component for selecting message urgency level
 * @param {Object} props - Component props
 * @param {string} props.selectedUrgency - Currently selected urgency level
 * @param {Function} props.onUrgencyChange - Callback when urgency changes
 * @returns {JSX.Element} UrgencySelector component
 */
const UrgencySelector = forwardRef(
  ({ selectedUrgency, onUrgencyChange }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      closeDropdown: () => {
        setIsOpen(false);
      },
    }));

    // Urgency levels with their display names and icons
    const urgencyLevels = [
      { id: "normal", name: "Normal", icon: "fa-minus", color: "#2196f3" },
      {
        id: "high",
        name: "High Priority",
        icon: "fa-arrow-up",
        color: "#ff9800",
      },
      {
        id: "urgent",
        name: "Urgent",
        icon: "fa-exclamation",
        color: "#f44336",
      },
    ];

    // Find the currently selected urgency level
    const selectedLevel =
      urgencyLevels.find((level) => level.id === selectedUrgency) ||
      urgencyLevels[1]; // Default to normal

    // Handle click outside to close dropdown
    useEffect(() => {
      function handleClickOutside(event) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target)
        ) {
          setIsOpen(false);
        }
      }

      // Only add the event listener when the dropdown is open
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [dropdownRef, isOpen]);

    // Toggle dropdown
    const toggleDropdown = (e) => {
      e.stopPropagation(); // Prevent event from bubbling up
      e.preventDefault(); // Prevent form submission
      setIsOpen(!isOpen);
    };

    // Handle urgency selection
    const handleUrgencySelect = (urgency, e) => {
      if (e) {
        e.stopPropagation(); // Prevent event from bubbling up
        e.preventDefault(); // Prevent form submission
      }
      onUrgencyChange(urgency);
      setIsOpen(false);
    };

    // Handle keydown to prevent form submission when pressing Enter
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    return (
      <div
        className="urgency-selector"
        ref={dropdownRef}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          className="urgency-button"
          onClick={toggleDropdown}
          title={`Message Priority: ${selectedLevel.name}`}
          style={{ color: selectedLevel.color }}
          onKeyDown={handleKeyDown}
        >
          <i className={`fas ${selectedLevel.icon}`}></i>
        </button>
        {isOpen && (
          <div className="urgency-dropdown">
            <div className="urgency-dropdown-header">
              <span>Set Message Priority</span>
            </div>
            <div className="urgency-options">
              {urgencyLevels.map((level) => (
                <div
                  key={level.id}
                  className={`urgency-option ${
                    selectedUrgency === level.id ? "selected" : ""
                  }`}
                  onClick={(e) => handleUrgencySelect(level.id, e)}
                >
                  <i
                    className={`fas ${level.icon}`}
                    style={{ color: level.color }}
                  ></i>
                  <span>{level.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default UrgencySelector;
