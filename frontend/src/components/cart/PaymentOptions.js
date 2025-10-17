import React, { useState } from "react";
import cardIcon from "../../assets/other-images/card-icon.svg";
import cashIcon from "../../assets/other-images/cash-icon.svg";
import appleIcon from "../../assets/other-images/apple-icon.svg";
import googleIcon from "../../assets/other-images/google-icon.svg";

function PaymentOptions() {
  const [selected, setSelected] = useState(null);

  const groups = [
    {
      title: "In-person",
      options: [
        { id: "card", label: "Credit Card", icon: cardIcon },
        { id: "cash", label: "Cash", icon: cashIcon },
      ],
    },
    {
      title: "In-app",
      options: [
        { id: "apple", label: "Apple Pay", icon: appleIcon, disabled: true },
        { id: "google", label: "Google Pay", icon: googleIcon, disabled: true },
      ],
    },
  ];

  return (
    <div className="block">
      <div className="block-title" style={{ marginBottom: 16 }}>Payment Options</div>
      <div className="pay-section">
        {groups.map((group) => (
          <div className="pay-group" key={group.title}>
            <div className="pay-group-title">{group.title}</div>
            <div className="pay-options-grid">
              {group.options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`pay-option ${selected === option.id ? "pay-option--outline" : ""}`}
                  onClick={() => setSelected(option.id)}
                  disabled={option.disabled}
                >
                  <img src={option.icon} alt="" className="pay-icon" />
                  <span>
                    {option.label}
                    {option.disabled ? " (Coming soon)" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PaymentOptions;
