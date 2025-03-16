const bcrypt = require("bcryptjs");

const plainPassword = "password123";  // Same password you used for login

bcrypt.hash(plainPassword, 10, (err, hash) => {
  if (err) {
    console.error("Error hashing password:", err);
  } else {
    console.log("Hashed password:", hash);
  }
});
