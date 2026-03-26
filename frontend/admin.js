const API_URL = "http://localhost:5011";
const ADMIN_TOKEN_KEY = "adminAuthToken";

window.addEventListener("DOMContentLoaded", () => {
  initAdminAuth();
});

function initAdminAuth() {
  const loginForm = document.getElementById("adminLoginForm");
  const logoutButton = document.getElementById("adminLogoutButton");

  // Force admin login every time admin page opens.
  localStorage.removeItem(ADMIN_TOKEN_KEY);

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = document.getElementById("adminUsername")?.value?.trim() || "";
      const password = document.getElementById("adminPassword")?.value || "";
      const loginMessage = document.getElementById("adminLoginMessage");
      const loginButton = document.getElementById("adminLoginButton");

      if (!username || !password) {
        if (loginMessage) {
          loginMessage.textContent = "Enter admin username and password.";
        }
        return;
      }

      if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = "Logging in...";
      }

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
        showAdminPanel();
        await loadUsers();
      } catch (error) {
        if (loginMessage) {
          loginMessage.textContent = error.message || "Invalid credentials.";
        }
      } finally {
        if (loginButton) {
          loginButton.disabled = false;
          loginButton.textContent = "Login";
        }
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      showLoginPanel();
    });
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

    renderUsers(data.users || []);
    if (message) {
      message.textContent = `Total users: ${(data.users || []).length}`;
    }
  } catch (error) {
    console.error("Admin load error:", error);
    tableBody.innerHTML = `<tr><td class="empty-row" colspan="7">Failed to load users</td></tr>`;
    if (message) {
      message.textContent = "Could not fetch users from server.";
    }
  }
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
        status === "Approved"
          ? "tag-approved"
          : status === "Rejected"
            ? "tag-rejected"
            : "tag-pending";

      const screenshotHtml = user.screenshot
        ? `<a href="${API_URL}/uploads/${user.screenshot}" target="_blank" rel="noreferrer"><img class="shot" src="${API_URL}/uploads/${user.screenshot}" alt="${user.name} screenshot" /></a>`
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

        await loadUsers();
      } catch (error) {
        console.error(`Action ${action} failed:`, error);
        alert(error.message || `Could not ${action} user`);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
