const API_BASE = "https://tournament-ff.onrender.com";
const REQUEST_TIMEOUT_MS = 15000;

const endpoints = {
  register: ["/api/register", "/register"],
  users: ["/api/users", "/users"],
};

const pageLoader = document.getElementById("pageLoader");
const registrationForm = document.getElementById("registrationForm");
const screenshotInput = document.getElementById("screenshot");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submitBtn");
const btnLoader = document.getElementById("btnLoader");
const usersTableBody = document.getElementById("usersTableBody");
const toast = document.getElementById("toast");

window.addEventListener("DOMContentLoaded", async () => {
  initRevealAnimations();
  initPreview();
  initFormSubmission();
  await loadUsers();
  hideLoader();
});

function initRevealAnimations() {
  const sections = document.querySelectorAll(".reveal");
  if (!sections.length) {
    return;
  }

  sections.forEach((section, index) => {
    section.style.animationDelay = `${Math.min(index * 80, 320)}ms`;
  });

  if (!("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  sections.forEach((section) => observer.observe(section));
}

function initPreview() {
  screenshotInput.addEventListener("change", () => {
    const file = screenshotInput.files && screenshotInput.files[0];

    if (!file) {
      preview.textContent = "No screenshot selected";
      return;
    }

    const image = document.createElement("img");
    image.src = URL.createObjectURL(file);
    image.alt = "Payment screenshot preview";
    preview.innerHTML = "";
    preview.appendChild(image);

    if (!file.type.startsWith("image/")) {
      setError("screenshotError", "Please upload a valid image file.");
      screenshotInput.value = "";
      preview.textContent = "No screenshot selected";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("screenshotError", "Image size must be 2MB or less.");
      screenshotInput.value = "";
      preview.textContent = "No screenshot selected";
      return;
    }

    setError("screenshotError", "");
  });
}

function initFormSubmission() {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const validation = validateForm();
    if (!validation.valid) {
      showToast("Please fix the highlighted errors.", "error");
      return;
    }

    const formData = new FormData(registrationForm);

    toggleSubmitting(true);
    try {
      const data = await postToAvailableEndpoint(endpoints.register, {
        method: "POST",
        mode: "cors",
        body: formData,
      });

      if (!data.success) {
        throw new Error(data.message || "Registration failed");
      }

      showToast("Registration successful. Waiting for admin verification.", "success");
      registrationForm.reset();
      preview.textContent = "No screenshot selected";
      clearErrors();
      await loadUsers();
    } catch (error) {
      showToast(error.message || "Registration failed. Please try again.", "error");
    } finally {
      toggleSubmitting(false);
    }
  });
}

function validateForm() {
  clearErrors();

  const name = document.getElementById("name").value.trim();
  const uid = document.getElementById("uid").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const transactionId = document.getElementById("transactionId").value.trim();
  const screenshot = screenshotInput.files && screenshotInput.files[0];

  let valid = true;

  if (name.length < 3) {
    setError("nameError", "Name must be at least 3 characters.");
    markInputInvalid("name", true);
    valid = false;
  } else {
    markInputInvalid("name", false);
  }

  if (!/^\d{6,}$/.test(uid)) {
    setError("uidError", "UID should be numeric and at least 6 digits.");
    markInputInvalid("uid", true);
    valid = false;
  } else {
    markInputInvalid("uid", false);
  }

  if (!/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
    setError("phoneError", "Phone must be exactly 10 digits.");
    markInputInvalid("phone", true);
    valid = false;
  } else {
    markInputInvalid("phone", false);
  }

  if (transactionId.length < 6) {
    setError("transactionError", "Transaction ID must be at least 6 characters.");
    markInputInvalid("transactionId", true);
    valid = false;
  } else {
    markInputInvalid("transactionId", false);
  }

  if (!screenshot) {
    setError("screenshotError", "Payment screenshot is required.");
    valid = false;
  } else if (!screenshot.type.startsWith("image/")) {
    setError("screenshotError", "Please upload a valid image file.");
    valid = false;
  } else if (screenshot.size > 2 * 1024 * 1024) {
    setError("screenshotError", "Image size must be 2MB or less.");
    valid = false;
  }

  return { valid };
}

function markInputInvalid(id, isInvalid) {
  const input = document.getElementById(id);
  if (!input) {
    return;
  }
  input.classList.toggle("input-invalid", isInvalid);
}

function setError(id, message) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = message;
  }
}

function clearErrors() {
  const allErrors = document.querySelectorAll(".error");
  allErrors.forEach((errorNode) => {
    errorNode.textContent = "";
  });
  ["name", "uid", "phone", "transactionId"].forEach((id) => markInputInvalid(id, false));
}

async function loadUsers() {
  usersTableBody.innerHTML = '<tr><td colspan="5" class="empty">Loading users...</td></tr>';

  try {
    showToast("Refreshing dashboard...", "info");
    const data = await getFromAvailableEndpoint(endpoints.users, { mode: "cors" });
    const users = Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : [];
    renderUsers(users);
    updateStats(users);
  } catch (error) {
    usersTableBody.innerHTML = `<tr><td colspan="5" class="empty">${sanitize(error.message || "Could not load users")}</td></tr>`;
  }
}

function renderUsers(users) {
  if (!users.length) {
    usersTableBody.innerHTML = '<tr><td colspan="5" class="empty">No users registered yet.</td></tr>';
    return;
  }

  usersTableBody.innerHTML = users
    .map((user) => {
      const status = String(user.status || "Pending");
      return `<tr>
        <td>${sanitize(user.name || "-")}</td>
        <td>${sanitize(user.uid || "-")}</td>
        <td>${sanitize(user.phone || "-")}</td>
        <td>${sanitize(user.transactionId || "-")}</td>
        <td><span class="status ${status.toLowerCase()}">${sanitize(status)}</span></td>
      </tr>`;
    })
    .join("");
}

function updateStats(users) {
  const total = users.length;
  const approved = users.filter((u) => ["Approved", "Completed"].includes(String(u.status))).length;
  const pending = users.filter((u) => !u.status || String(u.status) === "Pending").length;
  const rejected = users.filter((u) => String(u.status) === "Rejected").length;

  setText("heroTotal", total);
  setText("heroApproved", approved);
  setText("heroPending", pending);
  setText("totalCount", total);
  setText("approvedCount", approved);
  setText("pendingCount", pending);
  setText("rejectedCount", rejected);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = String(value);
  }
}

async function postToAvailableEndpoint(paths, fetchOptions) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await fetchWithTimeout(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers: {
          Accept: "application/json",
          ...(fetchOptions.headers || {}),
        },
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        throw new Error(payload.message || `Request failed (${response.status}) at ${path}`);
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Request failed on all endpoints.");
}

async function getFromAvailableEndpoint(paths, fetchOptions) {
  let lastError = null;

  for (const path of paths) {
    try {
      const response = await fetchWithTimeout(`${API_BASE}${path}`, {
        method: "GET",
        ...fetchOptions,
        headers: {
          Accept: "application/json",
          ...(fetchOptions.headers || {}),
        },
      });
      const payload = await parseResponse(response);

      if (!response.ok) {
        throw new Error(payload.message || `Request failed (${response.status}) at ${path}`);
      }

      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Could not fetch users from backend.");
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { success: response.ok, message: text };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please check your network and try again.");
    }

    throw new Error(
      "Unable to connect to backend. If this continues, verify CORS and backend status on Render."
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function showToast(message, type) {
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function toggleSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting;
  btnLoader.classList.toggle("hidden", !isSubmitting);
}

function hideLoader() {
  window.setTimeout(() => {
    pageLoader.style.display = "none";
  }, 500);
}

function sanitize(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
