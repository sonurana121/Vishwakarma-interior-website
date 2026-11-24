// ===============================
// LOGIN / SIGNUP SWITCH
// ===============================

const loginForm = document.querySelector(".login-form");
const signupForm = document.querySelector(".signup-form");

function showSignup(event) {
    event.preventDefault();

    loginForm.classList.remove("active");
    signupForm.classList.add("active");
}

function showLogin(event) {
    event.preventDefault();

    signupForm.classList.remove("active");
    loginForm.classList.add("active");
}


// ===============================
// SHOW / HIDE PASSWORD
// ===============================

function togglePassword(id, element) {

    const password = document.getElementById(id);

    if (password.type === "password") {

        password.type = "text";
        element.textContent = "🙈";

    } else {

        password.type = "password";
        element.textContent = "👁";

    }
}


// ===============================
// LOGIN
// ===============================

document.getElementById("loginForm").addEventListener("submit", function(event) {

    event.preventDefault();

    const button = this.querySelector(".btn");

    button.classList.add("loading");

    button.textContent = "LOADING";

    setTimeout(() => {

        button.classList.remove("loading");

        button.textContent = "LOGIN";

        alert("Login successful!");

    }, 1500);
});


// ===============================
// SIGN UP
// ===============================

document.getElementById("signupForm").addEventListener("submit", function(event) {

    event.preventDefault();

    const button = this.querySelector(".btn");

    button.classList.add("loading");

    button.textContent = "CREATING";

    setTimeout(() => {

        button.classList.remove("loading");

        button.textContent = "CREATE ACCOUNT";

        alert("Account created successfully!");

    }, 1500);
});


// ===============================
// FORGOT PASSWORD
// ===============================

function forgotPassword(event) {

    event.preventDefault();

    const email = document.getElementById("loginEmail").value;

    if (email === "") {

        alert("Please enter your email address first.");

    } else {

        alert("Password reset link would be sent to: " + email);

    }
}