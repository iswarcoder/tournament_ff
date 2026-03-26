const API_URL = "http://localhost:5011";
const TOTAL_SLOTS = 50;

window.addEventListener("DOMContentLoaded", () => {
  initImagePreview();
  initRegistrationForm();
  loadData();
});

function initRegistrationForm() {
  const form = document.getElementById("registrationForm");
  const submitButton = document.getElementById("payRegisterButton");

  if (!form || !submitButton) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  submitButton.addEventListener("click", async () => {

    const screenshotInput = document.getElementById("paymentScreenshot");
    const screenshotFile = screenshotInput && screenshotInput.files ? screenshotInput.files[0] : null;

    if (!screenshotFile) {
      alert("Please select payment screenshot first.");
      return;
    }

    // As requested: show congratulations first, then store in database.
    alert("Congratulations! Your registration is being submitted ✅");

    submitButton.disabled = true;
    const previousText = submitButton.textContent;
    submitButton.textContent = "Submitting...";

    try {
      const formData = new FormData(form);

      const response = await fetch(API_URL + "/register", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Registration failed");
      }

      form.reset();
      const preview = document.getElementById("imagePreview");
      if (preview) {
        preview.innerHTML = "<p>No image selected yet</p>";
      }

      await loadData();
    } catch (error) {
      console.error("Registration error:", error);
      alert("Registration could not be saved in database. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = previousText || "Register";
    }
  });
}

function initImagePreview() {
  const fileInput = document.getElementById("paymentScreenshot");
  const preview = document.getElementById("imagePreview");

  if (!fileInput || !preview) {
    return;
  }

  fileInput.addEventListener("change", function () {
    const file = this.files && this.files[0];

    if (!file) {
      preview.innerHTML = "<p>No image selected yet</p>";
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${previewUrl}" alt="Selected payment screenshot" style="width:200px; border-radius:10px;" />`;
  });
}

function showRevealSections() {
  const revealElements = document.querySelectorAll(".reveal");
  revealElements.forEach((element) => element.classList.add("visible"));
}

async function loadData() {
  const loader = document.getElementById("loader");
  const app = document.getElementById("app");

  try {
    console.log("Fetching data...");

    const res = await fetch(API_URL + "/users");
    if (!res.ok) {
      throw new Error(`API failed with status ${res.status}`);
    }

    const data = await res.json();

    console.log("DATA:", data);

    if (loader) {
      loader.style.display = "none";
    }
    if (app) {
      app.style.display = "block";
    }

    showRevealSections();

    renderData(data);
  } catch (err) {
    console.error("ERROR:", err);

    if (loader) {
      loader.style.display = "none";
    }

    if (app) {
      app.style.display = "block";
    }

    showRevealSections();

    renderData([]);
  }
}

function renderData(users) {
  const container = document.getElementById("dataContainer");

  updateLiveSummary(users || []);
  renderDashboard(users || []);

  if (!container) {
    return;
  }

  // Keep the welcome section clean: all player data is shown in Dashboard only.
  container.innerHTML = "";
  container.style.display = "none";
}

function renderDashboard(users) {
  const totalEl = document.querySelector("#dashboard .dashboard-grid .stat-card:nth-child(1) strong");
  const verifiedEl = document.querySelector("#dashboard .dashboard-grid .stat-card:nth-child(2) strong");
  const pendingEl = document.querySelector("#dashboard .dashboard-grid .stat-card:nth-child(3) strong");
  const playersList = document.getElementById("players-list");

  const approvedCount = users.filter((u) => u && (u.status === "Approved" || u.status === "Completed")).length;
  const pendingCount = users.filter((u) => u && (u.status === "Pending" || !u.status)).length;

  if (totalEl) {
    totalEl.textContent = String(users.length);
  }
  if (verifiedEl) {
    verifiedEl.textContent = String(approvedCount);
  }
  if (pendingEl) {
    pendingEl.textContent = String(pendingCount);
  }

  if (!playersList) {
    return;
  }

  if (!users.length) {
    playersList.innerHTML = "<p>No players found yet.</p>";
    return;
  }

  playersList.innerHTML = users
    .map((user) => {
      const status = user.status || "Pending";
      const statusClass =
        status === "Approved" || status === "Completed"
          ? "status-ok"
          : status === "Rejected"
            ? "status-bad"
            : "status-pending";

      const screenshotUrl = user.screenshot
        ? `${API_URL}/uploads/${encodeURIComponent(user.screenshot)}`
        : "";

      const screenshotHtml = screenshotUrl
        ? `<img src="${screenshotUrl}" class="player-screenshot" alt="${user.name || "Player"} screenshot" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<p class='player-note'>Screenshot not found</p>');" />`
        : "<p class='player-note'>No screenshot</p>";

      return `
        <div class="player-card glass">
          ${screenshotHtml}
          <h4 class="player-name">${user.name || "Unknown"}</h4>
          <p class="player-meta">UID: ${user.uid || "-"}</p>
          <p class="player-meta">Slot: ${user.slotNumber ?? "-"}</p>
          <span class="player-status ${statusClass}">${status}</span>
          <p class="player-note">${user.notification || "No notification"}</p>
        </div>
      `;
    })
    .join("");
}

function updateLiveSummary(users) {
  const heroPlayers = document.getElementById("heroPlayers");
  const heroSlots = document.getElementById("heroSlots");
  const prizeAmountDisplay = document.getElementById("prizeAmountDisplay");

  const approvedCount = (users || []).filter(
    (user) => user && (user.status === "Approved" || user.status === "Completed")
  ).length;

  if (heroPlayers) {
    heroPlayers.textContent = String(approvedCount);
  }

  if (heroSlots) {
    heroSlots.textContent = String(Math.max(TOTAL_SLOTS - approvedCount, 0));
  }

  if (prizeAmountDisplay) {
    prizeAmountDisplay.textContent = "₹500";
  }
}
