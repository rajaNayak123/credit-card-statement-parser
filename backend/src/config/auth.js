import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import mongoose from "mongoose";

// Store the auth instance once created
let authInstance = null;

// Factory function to create auth instance after DB connection is ready
export const createAuth = () => {
  // Ensure connection is ready
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB connection not established. Make sure connectDB() is called before creating auth.");
  }
  
  // Get the native MongoDB driver database instance
  // mongoose.connection.db should be the native MongoDB driver Db instance
  let db = mongoose.connection.db;
  
  // Verify db has collection method (native MongoDB driver requirement)
  if (!db || typeof db.collection !== 'function') {
    try {
      const client = mongoose.connection.getClient();
      
      // Extract database name from connection string or use mongoose connection name
      // MongoDB URI format examples:
      // - mongodb+srv://user:pass@cluster.mongodb.net/dbname?options
      // - mongodb://user:pass@host:port/dbname?options
      const uri = process.env.MONGODB_URI || '';
      let dbName = null;
      
      // Parse URI to extract database name
      // Look for pattern: /databaseName (after @host or @host:port)
      const uriParts = uri.split('@');
      if (uriParts.length > 1) {
        // Get the part after @host
        const afterHost = uriParts[1];
        // Match /dbname or /dbname?options
        const dbMatch = afterHost.match(/\/([^/?]+)/);
        if (dbMatch && dbMatch[1]) {
          dbName = dbMatch[1];
        }
      }
      
      // Fallback options
      if (!dbName) {
        // Try mongoose connection name
        dbName = mongoose.connection.name;
        // If still no name, try to get from mongoose.connection.db
        if (!dbName && mongoose.connection.db) {
          dbName = mongoose.connection.db.databaseName;
        }
        // Last resort: use 'test' (MongoDB default)
        if (!dbName) {
          dbName = 'test';
        }
      }
      
      console.log("Getting database from MongoDB client, dbName:", dbName);
      db = client.db(dbName);
      
      // Verify the database object
      if (!db || typeof db.collection !== 'function') {
        throw new Error(`Database object from client.db("${dbName}") does not have collection method`);
      }
      
      console.log("✓ Successfully got database from MongoDB client");
    } catch (err) {
      console.error("✗ Error getting database from client:", err.message);
      console.error("  Mongoose connection state:", mongoose.connection.readyState);
      console.error("  Mongoose connection name:", mongoose.connection.name);
      console.error("  Mongoose connection db exists:", !!mongoose.connection.db);
      throw new Error("Failed to get MongoDB database: " + err.message);
    }
  } else {
    console.log("✓ Using mongoose.connection.db (native MongoDB driver)");
  }
  
  if (!db) {
    throw new Error("MongoDB database not available. Make sure connectDB() is called before creating auth.");
  }
  
  // Final verification
  if (typeof db.collection !== 'function') {
    console.error("Database object type:", typeof db);
    console.error("Database constructor:", db?.constructor?.name);
    console.error("Database properties:", Object.keys(db).slice(0, 10));
    throw new Error("Invalid database object. Expected native MongoDB driver Db instance with collection method.");
  }

  console.log("✓ Database object verified, ready for Better Auth");

  // Pass the database directly to the adapter
  // mongodbAdapter(db, config) expects the database object directly
  authInstance = betterAuth({
    baseURL: process.env.BETTER_AUTH_BASE_URL || "http://localhost:8000",
    secret: process.env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(db),
    trustedOrigins: ["http://localhost:3000"],

    emailAndPassword: {
      enabled: true,
    },

    socialProviders: {
      // Only include Google if you have the credentials
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }),
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
  });

  return authInstance;
};

// Getter function to retrieve the auth instance (for use in middleware)
export const getAuth = () => {
  if (!authInstance) {
    throw new Error("Auth instance not initialized. Make sure createAuth() is called first.");
  }
  return authInstance;
};