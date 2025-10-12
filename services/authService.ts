import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // Load user from localStorage on initialization
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    try {
      // Check if we're on the client side
      if (typeof window === "undefined") {
        console.log("🔍 Server-side rendering - skipping localStorage access");
        return;
      }

      const storedUser = localStorage.getItem("shopping_agent_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        // Validate the user object has required fields
        if (
          parsedUser &&
          parsedUser.id &&
          parsedUser.username &&
          parsedUser.created_at
        ) {
          this.currentUser = parsedUser;
          console.log("User loaded from localStorage:", parsedUser.username);
        } else {
          console.warn("Invalid user data in localStorage, clearing...");
          localStorage.removeItem("shopping_agent_user");
          this.currentUser = null;
        }
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      // Only try to remove from localStorage if we're on the client side
      if (typeof window !== "undefined") {
        localStorage.removeItem("shopping_agent_user");
      }
      this.currentUser = null;
    }
  }

  private saveUserToStorage(user: User | null): void {
    try {
      // Check if we're on the client side
      if (typeof window === "undefined") {
        console.log("🔍 Server-side rendering - skipping localStorage save");
        return;
      }

      if (user) {
        localStorage.setItem("shopping_agent_user", JSON.stringify(user));
        console.log("User saved to localStorage:", user.username);
      } else {
        localStorage.removeItem("shopping_agent_user");
        console.log("User removed from localStorage");
      }
    } catch (error) {
      console.error("Error saving user to localStorage:", error);
    }
  }

  async signUp(
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Check if username already exists
      const { data: existingUser } = await supabase
        .from("user_profile")
        .select("username")
        .eq("username", username)
        .single();

      if (existingUser) {
        return { success: false, error: "Username already exists" };
      }

      // Hash the password before saving
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert into user_profile table directly
      const { data: profileData, error: profileError } = await supabase
        .from("user_profile")
        .insert([
          {
            username: username,
            password: hashedPassword, // Now properly hashed
          },
        ])
        .select()
        .single();

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      this.currentUser = {
        id: profileData.id,
        username: profileData.username,
        created_at: profileData.created_at,
      };

      // Save user to localStorage
      this.saveUserToStorage(this.currentUser);

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error("Sign up error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  }

  async signIn(
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> {
    try {
      // Get user profile first
      const { data: profileData, error: profileError } = await supabase
        .from("user_profile")
        .select("*")
        .eq("username", username)
        .single();

      if (profileError || !profileData) {
        return { success: false, error: "Invalid username or password" };
      }

      // Compare the provided password with the stored hash
      const isPasswordValid = await bcrypt.compare(
        password,
        profileData.password
      );

      if (!isPasswordValid) {
        return { success: false, error: "Invalid username or password" };
      }

      this.currentUser = {
        id: profileData.id,
        username: profileData.username,
        created_at: profileData.created_at,
      };

      // Save user to localStorage
      this.saveUserToStorage(this.currentUser);

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error("Sign in error:", error);
      return { success: false, error: "An unexpected error occurred" };
    }
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    // Clear user from localStorage
    this.saveUserToStorage(null);
  }

  // Method to clear all user data (useful for debugging)
  clearUserData(): void {
    this.currentUser = null;
    this.saveUserToStorage(null);
  }

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  getCurrentUserSync(): User | null {
    return this.currentUser;
  }

  async getUserConversations(): Promise<Conversation[]> {
    try {
      if (!this.currentUser) {
        console.log("❌ No current user for fetching conversations");
        return [];
      }

      console.log("📋 Fetching conversations for user:", this.currentUser.id);

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", this.currentUser.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("❌ Error fetching conversations:", error);
        return [];
      }

      console.log("📊 Found conversations:", data?.length || 0);
      console.log("📋 Conversation IDs:", data?.map((c) => c.id) || []);
      console.log("📋 Conversation titles:", data?.map((c) => c.title) || []);

      // Check for duplicate conversation IDs
      if (data && data.length > 0) {
        const convIds = data.map((c) => c.id);
        const uniqueConvIds = [...new Set(convIds)];
        if (convIds.length !== uniqueConvIds.length) {
          console.error("🚨 DUPLICATE CONVERSATION IDS FOUND!", convIds);
        }

        // Also check for duplicate titles
        await this.identifyDuplicateConversations();
      }

      return data || [];
    } catch (error) {
      console.error("❌ Error fetching conversations:", error);
      return [];
    }
  }

  async createConversation(title?: string): Promise<Conversation | null> {
    try {
      if (!this.currentUser) {
        console.log("❌ No current user for conversation creation");
        return null;
      }

      console.log("🆕 Creating new conversation with title:", title || "null");
      console.log("👤 User ID:", this.currentUser.id);

      const { data, error } = await supabase
        .from("conversations")
        .insert({
          user_id: this.currentUser.id,
          title: title || null,
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Error creating conversation:", error);
        return null;
      }

      console.log("✅ Conversation created successfully:", data.id);
      return data;
    } catch (error) {
      console.error("❌ Error creating conversation:", error);
      return null;
    }
  }

  async getConversationMessages(
    conversationId: string
  ): Promise<ChatMessage[]> {
    try {
      console.log("🔍 Fetching messages for conversation:", conversationId);
      console.log(
        "🔍 Query: SELECT * FROM chat_messages WHERE conversation_id =",
        conversationId
      );

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ Error fetching messages:", error);
        return [];
      }

      console.log("📊 Raw database response:", data?.length || 0, "messages");
      console.log("📋 Database message IDs:", data?.map((m) => m.id) || []);
      console.log(
        "📋 Database conversation IDs:",
        data?.map((m) => m.conversation_id) || []
      );

      // Verify all messages belong to the requested conversation
      if (data && data.length > 0) {
        const wrongConversationIds = data.filter(
          (m) => m.conversation_id !== conversationId
        );
        if (wrongConversationIds.length > 0) {
          console.error(
            "🚨 WRONG CONVERSATION MESSAGES FOUND!",
            wrongConversationIds
          );
          console.error("🚨 Requested conversation ID:", conversationId);
          console.error(
            "🚨 Found messages from conversations:",
            wrongConversationIds.map((m) => m.conversation_id)
          );
        }
      }

      // Check for duplicates in database response
      if (data && data.length > 0) {
        const dbIds = data.map((m) => m.id);
        const uniqueDbIds = [...new Set(dbIds)];
        if (dbIds.length !== uniqueDbIds.length) {
          console.error("🚨 DUPLICATES FOUND IN DATABASE RESPONSE!", dbIds);
        }
      }

      // Filter out any messages that don't belong to the requested conversation
      const filteredMessages =
        data?.filter((m) => m.conversation_id === conversationId) || [];

      if (filteredMessages.length !== (data?.length || 0)) {
        console.warn(
          "⚠️ Filtered out messages from wrong conversations:",
          (data?.length || 0) - filteredMessages.length
        );
      }

      console.log("✅ Final filtered messages:", filteredMessages.length);
      console.log(
        "✅ Final message IDs:",
        filteredMessages.map((m) => m.id)
      );
      console.log(
        "✅ Final conversation IDs:",
        filteredMessages.map((m) => m.conversation_id)
      );

      return filteredMessages;
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      return [];
    }
  }

  // Helper function to identify conversations with duplicate titles
  async identifyDuplicateConversations(): Promise<void> {
    try {
      if (!this.currentUser) {
        console.log("❌ No current user for duplicate check");
        return;
      }

      console.log("🔍 Checking for conversations with duplicate titles...");

      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", this.currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(
          "❌ Error fetching conversations for duplicate check:",
          error
        );
        return;
      }

      if (!data || data.length === 0) {
        console.log("📊 No conversations found");
        return;
      }

      // Group conversations by title
      const titleGroups: { [title: string]: Conversation[] } = {};
      data.forEach((conv) => {
        const title = conv.title || "Untitled";
        if (!titleGroups[title]) {
          titleGroups[title] = [];
        }
        titleGroups[title].push(conv);
      });

      // Find duplicates
      const duplicates = Object.entries(titleGroups).filter(
        ([, convs]) => convs.length > 1
      );

      if (duplicates.length > 0) {
        console.warn("⚠️ Found conversations with duplicate titles:");
        duplicates.forEach(([title, convs]) => {
          console.warn(`📋 Title: "${title}" (${convs.length} conversations)`);
          convs.forEach((conv) => {
            console.warn(`  - ID: ${conv.id}, Created: ${conv.created_at}`);
          });
        });
      } else {
        console.log("✅ No duplicate conversation titles found");
      }
    } catch (error) {
      console.error("❌ Error checking for duplicate conversations:", error);
    }
  }

  // Delete entire conversation and all its messages
  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      if (!this.currentUser) {
        console.log("❌ No current user for conversation deletion");
        return false;
      }

      console.log("🗑️ Deleting conversation:", conversationId);

      // Delete all messages first (due to foreign key constraints)
      const { error: messagesError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", this.currentUser.id);

      if (messagesError) {
        console.error("❌ Error deleting messages:", messagesError);
        return false;
      }

      // Delete the conversation
      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", this.currentUser.id);

      if (conversationError) {
        console.error("❌ Error deleting conversation:", conversationError);
        return false;
      }

      console.log("✅ Conversation deleted successfully:", conversationId);
      return true;
    } catch (error) {
      console.error("❌ Error deleting conversation:", error);
      return false;
    }
  }

  async saveMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string
  ): Promise<ChatMessage | null> {
    try {
      if (!this.currentUser) {
        return null;
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          user_id: this.currentUser.id,
          role: role,
          content: content,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving message:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error saving message:", error);
      return null;
    }
  }

  async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<boolean> {
    try {
      if (!this.currentUser) {
        return false;
      }

      const { error } = await supabase
        .from("conversations")
        .update({ title: title })
        .eq("id", conversationId)
        .eq("user_id", this.currentUser.id);

      if (error) {
        console.error("Error updating conversation title:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error updating conversation title:", error);
      return false;
    }
  }
}

export const authService = new AuthService();
