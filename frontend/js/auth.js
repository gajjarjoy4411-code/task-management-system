// Redirect to dashboard if already logged in
if (localStorage.getItem("token")) {
  window.location.href = "dashboard.html";
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
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "dashboard.html";
  } catch (err) {
    errorEl.textContent = "Could not connect to server. Is the backend running?";
  }
});

// ---- Register ----
document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("register-error");
  errorEl.textContent = "";

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
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    window.location.href = "dashboard.html";
  } catch (err) {
    errorEl.textContent = "Could not connect to server. Is the backend running?";
  }
});
// ---- Show/hide password toggle ----
document.querySelectorAll(".toggle-password-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    btn.textContent = isHidden ? "🙈" : "👁️";
    btn.title = isHidden ? "Hide password" : "Show password";
  });
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