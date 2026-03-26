const API_URL = "https://tournament-ff.onrender.com";
const ADMIN_TOKEN_KEY = "adminAuthToken";
const FIXED_ADMIN_USERNAME = "SWADHIN MANDAL";
let allUsers = [];
let adminToastTimer = null;

window.addEventListener("DOMContentLoaded", () => {
  initAdminAuth();
});

function initAdminAuth() {
  const loginForm = document.getElementById("adminLoginForm");
  const logoutButton = document.getElementById("adminLogoutButton");
  const refreshButton = document.getElementById("adminRefreshButton");
  const statusFilter = document.getElementById("statusFilter");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = FIXED_ADMIN_USERNAME;
      const password = document.getElementById("adminPassword")?.value || "";
      const loginMessage = document.getElementById("adminLoginMessage");
      const loginButton = document.getElementById("adminLoginButton");

      if (!password) {
        if (loginMessage) {
          loginMessage.textContent = "Enter admin password.";
        }
        return;
      }

      if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "Logging in...";
      }
      setAdminLoading(true, "Verifying admin credentials...");

      try {
        const response = await fetch(`${API_URL}/api/admin/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.token) {
          throw new Error(data.message || "Login failed");
        }

        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        if (loginMessage) {
          loginMessage.textContent = "Login successful.";
        }
        showAdminToast("Login successful.", "success");
        showAdminPanel();
        await loadUsers();
      } catch (error) {
        if (loginMessage) {
          loginMessage.textContent = error.message || "Invalid credentials.";
        }
        showAdminToast(error.message || "Invalid credentials.", "error");
      } finally {
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.textContent = "Login";
        }
        setAdminLoading(false);
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      showLoginPanel();
      showAdminToast("Logged out successfully.", "info");
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      showAdminToast("Refreshing users...", "info");
      await loadUsers();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      applyFilterAndRender();
    });
  }

  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) {
    showAdminPanel();
    loadUsers();
    return;
  }

  showLoginPanel();
}

function showAdminPanel() {
  const loginSection = document.getElementById("adminLoginSection");
  const panelSection = document.getElementById("adminPanelSection");

  if (loginSection) {
    loginSection.style.display = "none";
  }
  if (panelSection) {
    panelSection.style.display = "block";
  }
}

function showLoginPanel() {
  const loginSection = document.getElementById("adminLoginSection");
  const panelSection = document.getElementById("adminPanelSection");
  const loginMessage = document.getElementById("adminLoginMessage");

  if (loginSection) {
    loginSection.style.display = "block";
  }
  if (panelSection) {
    panelSection.style.display = "none";
  }
  if (loginMessage) {
    loginMessage.textContent = "Login as admin to continue.";
  }
}

async function loadUsers() {
  const tableBody = document.getElementById("adminUsersBody");
  const message = document.getElementById("adminMessage");
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);

  if (!tableBody || !token) {
    return;
  }

  try {
    setAdminLoading(true, "Fetching user requests...");
    const response = await fetch(`${API_URL}/api/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      if (response.status === 401) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        showLoginPanel();
      }
      throw new Error(data.message || "Failed to load users");
    }

    allUsers = data.users || [];
    applyFilterAndRender();

    const approvedCount = allUsers.filter((u) => {
      const status = String(u.status || "").toLowerCase();
      return status === "approved" || status === "completed";
    }).length;
    const rejectedCount = allUsers.filter((u) => String(u.status || "").toLowerCase() === "rejected").length;
    const pendingCount = allUsers.filter((u) => String(u.status || "pending").toLowerCase() === "pending").length;

    if (message) {
      message.textContent = `Total: ${allUsers.length} | Approved: ${approvedCount} | Rejected: ${rejectedCount} | Pending: ${pendingCount}`;
    }
    showAdminToast("User list updated.", "success");
  } catch (error) {
    console.error("Admin load error:", error);
    tableBody.innerHTML = `<tr><td class="empty-row" colspan="7">Failed to load users</td></tr>`;
    if (message) {
      message.textContent = "Could not fetch users from server.";
    }
    showAdminToast(error.message || "Could not fetch users from server.", "error");
  } finally {
    setAdminLoading(false);
  }
}

function applyFilterAndRender() {
  const statusFilter = document.getElementById("statusFilter");
  const filterValue = (statusFilter?.value || "all").toLowerCase();

  if (filterValue === "all") {
    renderUsers(allUsers);
    return;
  }

  const filteredUsers = allUsers.filter((user) => {
    const status = String(user.status || "pending").toLowerCase();
    if (filterValue === "approved") {
      return status === "approved" || status === "completed";
    }
    return status === filterValue;
  });

  renderUsers(filteredUsers);
}

function renderUsers(users) {
  const tableBody = document.getElementById("adminUsersBody");
  if (!tableBody) {
    return;
  }

  if (!users.length) {
    tableBody.innerHTML = `<tr><td class="empty-row" colspan="7">No users found</td></tr>`;
    return;
  }

  tableBody.innerHTML = users
    .map((user) => {
      const status = user.status || "Pending";
      const statusClass =
        status === "Approved" || status === "Completed"
          ? "tag-approved"
          : status === "Rejected"
            ? "tag-rejected"
            : "tag-pending";

      const screenshotHtml = user.screenshot
        ? `<a href="${API_URL}/uploads/${encodeURIComponent(user.screenshot)}" target="_blank" rel="noreferrer"><img class="shot" src="${API_URL}/uploads/${encodeURIComponent(user.screenshot)}" alt="${escapeHtml(user.name || "Player")} screenshot" /></a>`
        : "No screenshot";

      return `
      <tr>
        <td>${escapeHtml(user.name || "-")}</td>
        <td>${escapeHtml(user.uid || "-")}</td>
        <td><span class="tag ${statusClass}">${escapeHtml(status)}</span></td>
        <td>${user.slotNumber ?? "-"}</td>
        <td>${escapeHtml(user.notification || "-")}</td>
        <td>${screenshotHtml}</td>
        <td>
          <div class="action-group">
            <button class="mini-btn mini-btn-approve" data-action="approve" data-id="${user.id}">Approve</button>
            <button class="mini-btn mini-btn-reject" data-action="reject" data-id="${user.id}">Reject</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  bindActionButtons();
}

function bindActionButtons() {
  const buttons = document.querySelectorAll("button[data-action][data-id]");
  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-action");
      const userId = button.getAttribute("data-id");

      if (!action || !userId) {
        return;
      }

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "...";
      setAdminLoading(true, action === "approve" ? "Approving request..." : "Rejecting request...");

      try {
        const token = localStorage.getItem(ADMIN_TOKEN_KEY);
        if (!token) {
          showLoginPanel();
          return;
        }

        const endpoint =
          action === "approve"
            ? `${API_URL}/api/approve/${userId}`
            : `${API_URL}/api/reject/${userId}`;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          if (response.status === 401) {
            localStorage.removeItem(ADMIN_TOKEN_KEY);
            showLoginPanel();
          }
          throw new Error(data.message || `Failed to ${action}`);
        }

        showAdminToast(
          action === "approve" ? "User approved successfully." : "User rejected successfully.",
          "success"
        );
        await loadUsers();
      } catch (error) {
        console.error(`Action ${action} failed:`, error);
        showAdminToast(error.message || `Could not ${action} user`, "error");
      } finally {
        button.disabled = false;
        button.textContent = originalText;
        setAdminLoading(false);
      }
    });
  });
}

function setAdminLoading(isLoading, text = "Loading...") {
  const loader = document.getElementById("adminLoader");
  const loaderText = document.getElementById("adminLoaderText");

  if (!loader) {
    return;
  }

  if (loaderText) {
    loaderText.textContent = text;
  }

  loader.classList.toggle("active", isLoading);
  loader.setAttribute("aria-hidden", String(!isLoading));
}

function showAdminToast(message, type = "info") {
  const toast = document.getElementById("adminToast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.className = `admin-toast show ${type}`;

  if (adminToastTimer) {
    clearTimeout(adminToastTimer);
  }

  adminToastTimer = setTimeout(() => {
    toast.className = "admin-toast";
  }, 2600);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
