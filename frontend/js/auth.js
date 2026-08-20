// Redirect to dashboard if already logged in
if (localStorage.getItem("token")) {
  window.location.href = "dashboard.html";
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
}
function setButtonState(btn, state, text) {
  const label = btn.querySelector(".btn-label");
  btn.disabled = state === "loading" || state === "success";
  btn.classList.remove("btn-loading", "btn-success");

  if (state === "loading") {
    btn.classList.add("btn-loading");
    label.innerHTML = `<span class="btn-spinner"></span> ${text}`;
  } else if (state === "success") {
    btn.classList.add("btn-success");
    label.textContent = `✓ ${text}`;
  } else {
    label.textContent = text;
  }
}
// ---- Tab switching ----
const tabBtns = document.querySelectorAll(".tab-btn");
const forms = document.querySelectorAll(".auth-form");

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    forms.forEach((f) => f.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(`${btn.dataset.tab}-form`).classList.add("active");
  });
});

// ---- Login ----
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  const btn = document.getElementById("login-submit-btn");
  setButtonState(btn, "loading", "Logging in...");

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.msg || "Login failed";
      setButtonState(btn, "idle", "Log In");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    setButtonState(btn, "success", "Logged In");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 600);
  } catch (err) {
    errorEl.textContent = "Could not connect to server. Is the backend running?";
    setButtonState(btn, "idle", "Log In");
  }
});

// ---- Register ----
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

  const btn = document.getElementById("register-submit-btn");
  setButtonState(btn, "loading", "Creating...");

  const name = document.getElementById("register-name").value;
  const email = document.getElementById("register-email").value;
  const password = document.getElementById("register-password").value;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.msg || "Registration failed";
      setButtonState(btn, "idle", "Create Account");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    setButtonState(btn, "success", "Account Created");
    showToast("✓ Account created successfully!");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1200);
  } catch (err) {
    errorEl.textContent = "Could not connect to server. Is the backend running?";
    setButtonState(btn, "idle", "Create Account");
  }
});


// ---- Password strength meter ----
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { percent: 20, label: "Weak", color: "#ef4444" };
  if (score <= 2) return { percent: 45, label: "Fair", color: "#f0a868" };
  if (score <= 3) return { percent: 70, label: "Good", color: "#eab308" };
  return { percent: 100, label: "Strong", color: "#22c55e" };
}

const registerPasswordInput = document.getElementById("register-password");
const strengthWrap = document.getElementById("password-strength");
const strengthFill = document.getElementById("strength-bar-fill");
const strengthLabel = document.getElementById("strength-label");

registerPasswordInput.addEventListener("input", () => {
  const value = registerPasswordInput.value;

  if (!value) {
    strengthWrap.style.display = "none";
    return;
  }

  strengthWrap.style.display = "flex";
  const { percent, label, color } = getPasswordStrength(value);
  strengthFill.style.width = `${percent}%`;
  strengthFill.style.background = color;
  strengthLabel.textContent = label;
  strengthLabel.style.color = color;
});

// ---- Forgot password (placeholder — needs backend email flow to work) ----
document.getElementById("forgot-password-link").addEventListener("click", (e) => {
  e.preventDefault();
  alert("Password reset isn't set up yet — this needs email support on the backend first.");
});