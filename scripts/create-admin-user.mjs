import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1)];
    }),
);

const url = env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const adminEmail = "shushovan015@gmail.com";
const adminPassword = "shakya1234";

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAdminUser() {
  console.log("Creating admin user...");

  const { data: existingUser, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  const existingAdmin = existingUser.users.find((u) => u.email === adminEmail);

  if (existingAdmin) {
    console.log("Admin user already exists, updating password and role...");
    const { error: updateError } = await adminClient.auth.admin.updateUserById(existingAdmin.id, {
      password: adminPassword,
      email_confirm: true,
    });
    if (updateError) {
      console.error("Error updating user:", updateError.message);
      process.exit(1);
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({ id: existingAdmin.id, email: adminEmail, role: "admin" });
    if (profileError) {
      console.error("Error updating profile:", profileError.message);
      process.exit(1);
    }
    console.log("Admin user updated successfully!");
    return;
  }

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: "Admin User" },
  });

  if (createError) {
    console.error("Error creating user:", createError.message);
    process.exit(1);
  }

  console.log("User created:", newUser.user.id);

  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({ id: newUser.user.id, email: adminEmail, role: "admin" });

  if (profileError) {
    console.error("Error creating profile:", profileError.message);
    process.exit(1);
  }

  console.log("Admin user created successfully!");
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
}

createAdminUser();