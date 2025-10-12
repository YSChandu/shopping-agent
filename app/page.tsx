"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Phone } from "../types";
import { phoneService } from "../services/phoneService";
import { aiService } from "../services/aiService";
import { authService, User } from "../services/authService";
import MarkdownRenderer from "../components/MarkdownRenderer";
import AuthModal from "../components/AuthModal";
import Sidebar from "../components/Sidebar";
import DesktopSidebar from "../components/DesktopSidebar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [isInChat, setIsInChat] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [clickedPrompt, setClickedPrompt] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const chatAreaRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Authentication state
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [showSidebar, setShowSidebar] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [currentChatTitle, setCurrentChatTitle] = useState<string>("");
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);

  const saveCurrentChatToDatabase = useCallback(async () => {
    console.log(" saveCurrentChatToDatabase called");
    console.log(" User:", !!user);
    console.log(" Messages count:", messages.length);
    console.log(" Current conversation ID:", currentConversationId);
    console.log(" Is switching conversation:", isSwitchingConversation);

    if (!user || messages.length === 0) {
      console.log(" Skipping save - no user or no messages");
      return;
    }

    // Don't save if we're in the middle of switching conversations
    if (isSwitchingConversation) {
      console.log(" Skipping save - currently switching conversations");
      return;
    }

    // Check if user has made any changes
    if (!hasUserMadeChanges) {
      console.log("Skipping save - no changes made by user");
      return;
    }

    console.log(
      " User changes detected - proceeding with delete-and-recreate save..."
    );

    try {
      console.log(" Starting delete-and-recreate save...");

      // If we have an existing conversation, delete it first
      if (currentConversationId) {
        console.log(
          " Deleting existing conversation:",
          currentConversationId
        );
        const deleted = await authService.deleteConversation(
          currentConversationId
        );
        if (!deleted) {
          console.error("Failed to delete existing conversation");
          return;
        }
      }

      // Create new conversation with fresh timestamp
      console.log("Creating new conversation...");
      const conversation = await authService.createConversation();
      if (!conversation) {
        console.error(" Failed to create new conversation");
        return;
      }

      const newConversationId = conversation.id;
      setCurrentConversationId(newConversationId);
      console.log(" Created new conversation:", newConversationId);

      // Save all messages to the new conversation
      for (const message of messages) {
        console.log(
          "Saving message:",
          message.role,
          message.content.substring(0, 50)
        );
        await authService.saveMessage(
          newConversationId,
          message.role,
          message.content
        );
      }

      // Set conversation title with timestamp
      const firstUserMessage = messages.find((msg) => msg.role === "user");
      if (firstUserMessage) {
        const title =
          firstUserMessage.content.length > 50
            ? firstUserMessage.content.substring(0, 50) + "..."
            : firstUserMessage.content;

        // Add timestamp to make title unique
        const uniqueTitle = `${title} (${new Date().toLocaleString()})`;
        console.log("Generated unique title:", uniqueTitle);
        await authService.updateConversationTitle(
          newConversationId,
          uniqueTitle
        );
      }

      console.log(
        "Conversation saved with delete-and-recreate approach:",
        newConversationId
      );

      // Reset the changes flag since we've saved
      setHasUserMadeChanges(false);
      console.log("Changes flag reset");
    } catch (error) {
      console.error("Error saving current chat:", error);
    }
  }, [
    user,
    messages,
    currentConversationId,
    isSwitchingConversation,
    hasUserMadeChanges,
  ]);

  const checkAuthStatus = () => {
    const currentUser = authService.getCurrentUserSync();
    setUser(currentUser);

    // If user is logged in, automatically redirect to chat interface
    if (currentUser) {
      setIsInChat(true);
    }
  };

  // Scroll synchronization removed to prevent unwanted sidebar movement

  useEffect(() => {
    setMounted(true);
    // Check if user is already authenticated
    checkAuthStatus();
  }, []);

  // Scroll event listeners removed to prevent unwanted sidebar movement

  // Debug useEffect to monitor messages changes (only log duplicates)
  useEffect(() => {
    if (messages.length > 0) {
      const ids = messages.map((m) => m.id);
      const uniqueIds = [...new Set(ids)];
      if (ids.length !== uniqueIds.length) {
        console.error("DUPLICATE MESSAGES DETECTED!", ids);
      }
    }
  }, [messages]);

  // Save chat when browser closes or page unloads
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (user && messages.length > 0) {
        // Use sendBeacon for reliable saving on page unload
        saveCurrentChatToDatabase();
      }
    };

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        user &&
        messages.length > 0
      ) {
        saveCurrentChatToDatabase();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, messages, currentConversationId, saveCurrentChatToDatabase]);

  const handleAuthSuccess = (user: User) => {
    setUser(user);
    setShowAuthModal(false);
    // Automatically redirect to chat interface after successful authentication
    setIsInChat(true);
  };

  const handleNewChat = async () => {
    console.log(" handleNewChat called");
    console.log(" Current user:", !!user);
    console.log(" Current messages count:", messages.length);
    console.log(" Current conversation ID:", currentConversationId);
    console.log(" Has user made changes:", hasUserMadeChanges);

    // Set flag to prevent saving during new chat creation
    setIsSwitchingConversation(true);

    // Save current conversation if there are messages and user has made changes
    if (user && messages.length > 0 && hasUserMadeChanges) {
      console.log(" Saving current chat before starting new one...");
      await saveCurrentChatToDatabase();
    } else {
      console.log(" No need to save - no user, no messages, or no changes");
    }

    // Start new chat - stay in chat interface
    setMessages([]);
    setInputMessage("");
    setCurrentConversationId(null);
    setCurrentChatTitle("");
    setShowMenu(false);
    setIsInChat(true); // Stay in chat interface
    setIsSwitchingConversation(false); // Clear flag after new chat is ready
    setHasUserMadeChanges(false); // Reset changes flag for new chat
    setShouldAutoScroll(true); // Enable auto-scroll for new chat
    console.log(" New chat started");
  };

  const handleSelectConversation = async (conversationId: string) => {
    console.log(" handleSelectConversation called with ID:", conversationId);
    console.log(" Current state - conversationId:", currentConversationId);
    console.log(
      " Current state - isLoadingConversation:",
      isLoadingConversation
    );
    console.log(" Current state - messages count:", messages.length);
    console.log(" Current state - hasUserMadeChanges:", hasUserMadeChanges);

    // Prevent duplicate calls for the same conversation or while loading
    if (currentConversationId === conversationId || isLoadingConversation) {
      console.log("Skipping duplicate conversation load:", conversationId);
      return;
    }

    // If we have a new chat with changes, save it first before loading history
    if (hasUserMadeChanges && messages.length > 0) {
      console.log(" Saving current new chat before loading history...");
      await saveCurrentChatToDatabase();
    }

    setIsLoadingConversation(true);
    setIsSwitchingConversation(true); // Set flag to prevent saving
    console.log(" Starting conversation load...");

    try {
      console.log(" Calling authService.getConversationMessages...");
      console.log("Loading conversation:", conversationId);
      console.log("Current conversation ID:", currentConversationId);
      console.log("Current messages count:", messages.length);

      // Clear messages first to prevent any race conditions
      setMessages([]);

      const conversationMessages = await authService.getConversationMessages(
        conversationId
      );

      console.log("Raw conversation messages:", conversationMessages.length);
      console.log(
        "Raw message IDs:",
        conversationMessages.map((m) => m.id)
      );

      // Check for duplicate IDs in the raw data
      const rawIds = conversationMessages.map((m) => m.id);
      const uniqueIds = [...new Set(rawIds)];
      if (rawIds.length !== uniqueIds.length) {
        console.warn("Duplicate IDs found in raw data:", rawIds);
      }

      const formattedMessages: Message[] = conversationMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at),
      }));

      console.log("Formatted messages:", formattedMessages.length);
      console.log(
        "Message IDs:",
        formattedMessages.map((m) => m.id)
      );

      // Check for duplicate IDs in formatted data
      const formattedIds = formattedMessages.map((m) => m.id);
      const uniqueFormattedIds = [...new Set(formattedIds)];
      if (formattedIds.length !== uniqueFormattedIds.length) {
        console.warn("Duplicate IDs found in formatted data:", formattedIds);
      }

      // Remove duplicates based on ID before setting messages
      const uniqueMessages = formattedMessages.filter(
        (message, index, self) =>
          index === self.findIndex((m) => m.id === message.id)
      );

      if (uniqueMessages.length !== formattedMessages.length) {
        console.warn(
          "Removed duplicate messages:",
          formattedMessages.length - uniqueMessages.length
        );
      }

      // Set all state at once to prevent race conditions
      setMessages(uniqueMessages);
      setCurrentConversationId(conversationId);
      setCurrentChatTitle(
        conversationMessages[0]?.content.substring(0, 50) + "..." || "Chat"
      );
      setIsInChat(true);
      setShouldAutoScroll(true); // Enable auto-scroll when loading conversation

      // Reset changes flag since we're loading existing conversation
      setHasUserMadeChanges(false);
      console.log(" Changes flag reset after conversation load");

      console.log(" Conversation loaded successfully");
    } catch (error) {
      console.error(" Error loading conversation:", error);
    } finally {
      setIsLoadingConversation(false);
      setIsSwitchingConversation(false); // Clear flag after switching is complete
      console.log(" Conversation loading finished");
    }
  };

  const saveMessageToDatabase = async (
    role: "user" | "assistant",
    content: string
  ) => {
    if (!user || !currentConversationId) return;

    try {
      await authService.saveMessage(currentConversationId, role, content);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        const target = event.target as Element;
        if (!target.closest(".menu-container")) {
          setShowMenu(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (shouldAutoScroll && chatAreaRef.current) {
      // Use setTimeout to ensure DOM has updated before scrolling
      setTimeout(() => {
        if (chatAreaRef.current) {
          chatAreaRef.current.scrollTo({
            top: chatAreaRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 50); // Small delay to ensure DOM updates
    }
  }, [messages, shouldAutoScroll]);

  // Handle scroll events to detect manual scrolling
  const handleScroll = useCallback(() => {
    if (!chatAreaRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px threshold

    setShouldAutoScroll(isAtBottom);
  }, []);

  // Attach scroll listener to chat area
  useEffect(() => {
    const chatArea = chatAreaRef.current;
    if (chatArea) {
      chatArea.addEventListener("scroll", handleScroll, { passive: true });
      return () => chatArea.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const handleStartChat = async () => {
    if (!inputMessage.trim()) return;

    setIsInChat(true);
    setShouldAutoScroll(true); // Enable auto-scroll when starting chat

    // Create conversation if user is signed in
    let conversationId = currentConversationId;
    if (user && !conversationId) {
      const conversation = await authService.createConversation();
      if (conversation) {
        conversationId = conversation.id;
        setCurrentConversationId(conversationId);
        // Set initial chat title from the first message
        setCurrentChatTitle(
          inputMessage.length > 50
            ? inputMessage.substring(0, 50) + "..."
            : inputMessage
        );
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database if signed in
    if (user && conversationId) {
      await saveMessageToDatabase("user", inputMessage);

      // Update conversation title with first message (truncated)
      if (messages.length === 0) {
        const title =
          inputMessage.length > 50
            ? inputMessage.substring(0, 50) + "..."
            : inputMessage;

        // Add timestamp to make title unique
        const uniqueTitle = `${title} (${new Date().toLocaleString()})`;
        console.log(" Generated unique title for new chat:", uniqueTitle);
        await authService.updateConversationTitle(conversationId, uniqueTitle);
        setCurrentChatTitle(uniqueTitle);
      }
    }

    const currentInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Get all phones for AI context
      const allPhones = await phoneService.getAllPhones();
      setPhones(allPhones);

      // Create initial assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Use streaming response with chat history
        const stream = aiService.generateStreamingResponse(
          currentInput,
          allPhones,
          messages.map((msg) => ({ role: msg.role, content: msg.content }))
        );

        let fullResponse = "";
        let hasContent = false;

        for await (const chunk of stream) {
          fullResponse += chunk;
          hasContent = true;

          // Update the assistant message with the new content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }

        // Save assistant message to database if signed in
        if (user && conversationId && hasContent) {
          await saveMessageToDatabase("assistant", fullResponse);
        }

        // If no content was received, show error
        if (!hasContent) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      "Sorry, I couldn't generate a response. Please try again.",
                  }
                : msg
            )
          );
        }
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "Sorry, I encountered an error while generating the response. Please try again.",
                }
              : msg
          )
        );
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error getting AI response:", error);
      setIsLoading(false);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleRegenerateResponse = async (userMessageContent: string) => {
    if (!userMessageContent.trim() || isLoading) return;

    // Remove the last assistant message and regenerate
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastAssistantIndex = newMessages.findLastIndex(
        (msg) => msg.role === "assistant"
      );
      if (lastAssistantIndex !== -1) {
        newMessages.splice(lastAssistantIndex, 1);
      }
      return newMessages;
    });

    setIsLoading(true);

    try {
      // Get all phones for AI context
      if (phones.length === 0) {
        const allPhones = await phoneService.getAllPhones();
        setPhones(allPhones);
      }

      // Create initial assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Use streaming response with chat history
        const stream = aiService.generateStreamingResponse(
          userMessageContent,
          phones.length > 0 ? phones : [],
          messages.map((msg) => ({ role: msg.role, content: msg.content }))
        );

        let fullResponse = "";
        let hasContent = false;

        for await (const chunk of stream) {
          fullResponse += chunk;
          hasContent = true;

          // Update the assistant message with the new content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }

        if (!hasContent) {
          // If no content was received, update with error message
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      "I'm having trouble processing your request right now. Please try again or rephrase your question.",
                  }
                : msg
            )
          );
        }
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "I'm having trouble processing your request right now. Please try again or rephrase your question.",
                }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Error generating response:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "I'm having trouble processing your request right now. Please try again or rephrase your question.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setHasUserMadeChanges(true); // Mark that user made changes

    // Clear input and maintain focus
    setInputMessage("");
    // Maintain focus on input after sending
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);

    // Save user message to database if signed in
    if (user && currentConversationId) {
      await saveMessageToDatabase("user", inputMessage);
    }

    const currentInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Get all phones for AI context
      if (phones.length === 0) {
        const allPhones = await phoneService.getAllPhones();
        setPhones(allPhones);
      }

      // Create initial assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Use streaming response with chat history
        const stream = aiService.generateStreamingResponse(
          currentInput,
          phones.length > 0 ? phones : [],
          messages.map((msg) => ({ role: msg.role, content: msg.content }))
        );

        let fullResponse = "";
        let hasContent = false;

        for await (const chunk of stream) {
          fullResponse += chunk;
          hasContent = true;

          // Update the assistant message with the new content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }

        // Save assistant message to database if signed in
        if (user && currentConversationId && hasContent) {
          await saveMessageToDatabase("assistant", fullResponse);
        }

        // If no content was received, show error
        if (!hasContent) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      "Sorry, I couldn't generate a response. Please try again.",
                  }
                : msg
            )
          );
        }
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "Sorry, I encountered an error while generating the response. Please try again.",
                }
              : msg
          )
        );
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error getting AI response:", error);
      setIsLoading(false);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isInChat) {
        handleStartChat();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingText(content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingText.trim()) return;

    // Find the index of the message being edited
    const editIndex = messages.findIndex((msg) => msg.id === editingMessageId);
    if (editIndex === -1) return;

    // Remove all messages after the edited message
    const updatedMessages = messages.slice(0, editIndex + 1);

    // Update the edited message
    updatedMessages[editIndex] = {
      ...updatedMessages[editIndex],
      content: editingText.trim(),
    };

    setMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingText("");

    // Send the edited message to AI without creating a duplicate
    await handleSendEditedMessage(editingText.trim(), updatedMessages);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSendEditedMessage = async (
    messageContent: string,
    messageHistory: Message[]
  ) => {
    if (!messageContent.trim() || isLoading) return;

    setIsLoading(true);

    try {
      // Get all phones for AI context
      if (phones.length === 0) {
        const allPhones = await phoneService.getAllPhones();
        setPhones(allPhones);
      }

      // Create initial assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Use streaming response with the updated chat history
        const stream = aiService.generateStreamingResponse(
          messageContent,
          phones.length > 0 ? phones : [],
          messageHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }))
        );

        let fullResponse = "";
        let hasContent = false;

        for await (const chunk of stream) {
          fullResponse += chunk;
          hasContent = true;

          // Update the assistant message with the new content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }

        // If no content was received, show error
        if (!hasContent) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      "Sorry, I couldn't generate a response. Please try again.",
                  }
                : msg
            )
          );
        }
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "Sorry, I encountered an error while generating the response. Please try again.",
                }
              : msg
          )
        );
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error sending edited message:", error);
      setIsLoading(false);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "I'm having trouble processing your request right now. Please try again or rephrase your question.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleGoHome = () => {
    setIsInChat(false);
    setMessages([]);
    setInputMessage("");
    setShowMenu(false);
  };

  const handlePromptClick = async (promptText: string) => {
    setClickedPrompt(promptText);
    setIsInChat(true);
    setInputMessage(promptText); // Set the input message to show the clicked prompt

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: promptText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = promptText; // Store the prompt text
    setInputMessage(""); // Clear the input field after sending
    setIsLoading(true);

    try {
      // Get all phones for AI context
      const allPhones = await phoneService.getAllPhones();
      setPhones(allPhones);

      // Create initial assistant message for streaming
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      // Add empty assistant message that we'll update
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Use streaming response with chat history
        const stream = aiService.generateStreamingResponse(
          currentInput,
          allPhones,
          messages.map((msg) => ({ role: msg.role, content: msg.content }))
        );

        let fullResponse = "";
        let hasContent = false;

        for await (const chunk of stream) {
          fullResponse += chunk;
          hasContent = true;

          // Update the assistant message with the new content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }

        // If no content was received, show error
        if (!hasContent) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content:
                      "Sorry, I couldn't generate a response. Please try again.",
                  }
                : msg
            )
          );
        }
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "Sorry, I encountered an error while generating the response. Please try again.",
                }
              : msg
          )
        );
      }

      setIsLoading(false);
      setClickedPrompt(null);
    } catch (error) {
      console.error("Error getting AI response:", error);
      setIsLoading(false);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setClickedPrompt(null);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isInChat) {
    return (
      <>
        <div className="min-h-screen bg-white flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              </div>
              <span className="text-base sm:text-lg font-bold text-gray-900 tracking-wide font-inter">
                SmartPick AI
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {user ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    Welcome, {user.username}
                  </span>
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setAuthMode("signin");
                      setShowAuthModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setAuthMode("signup");
                      setShowAuthModal(true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
            <div className="max-w-4xl w-full text-center">
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
                How can I help you today?
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
                I&apos;m your AI shopping assistant for mobile phones. Ask me
                about phones, compare models, or describe what you&apos;re
                looking for.
              </p>

              {/* Input Box */}
              <div className="max-w-2xl mx-auto px-2">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about phones, compare models, or describe what you're looking for..."
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 md:py-4 pr-10 sm:pr-12 text-sm sm:text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent shadow-sm"
                  />
                  <button
                    onClick={handleStartChat}
                    disabled={!inputMessage.trim()}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5-5 5M6 12h12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Example Prompts */}
              <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-4xl mx-auto px-2">
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                    clickedPrompt === "Best camera phone under ₹30,000"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    handlePromptClick("Best camera phone under ₹30,000")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Best camera phone under ₹30,000
                      </h3>
                      <p className="text-sm text-gray-700">
                        Find phones with excellent camera quality
                      </p>
                    </div>
                    {clickedPrompt === "Best camera phone under ₹30,000" && (
                      <div className="ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                    clickedPrompt === "Compare iPhone vs Samsung"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                  onClick={() => handlePromptClick("Compare iPhone vs Samsung")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Compare iPhone vs Samsung
                      </h3>
                      <p className="text-sm text-gray-700">
                        Get detailed comparisons between brands
                      </p>
                    </div>
                    {clickedPrompt === "Compare iPhone vs Samsung" && (
                      <div className="ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                    clickedPrompt === "Gaming phone under ₹25,000"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                  onClick={() =>
                    handlePromptClick("Gaming phone under ₹25,000")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Gaming phone under ₹25,000
                      </h3>
                      <p className="text-sm text-gray-700">
                        Find phones optimized for gaming
                      </p>
                    </div>
                    {clickedPrompt === "Gaming phone under ₹25,000" && (
                      <div className="ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                    clickedPrompt === "Battery life comparison"
                      ? "border-blue-500 bg-blue-50 shadow-md"
                      : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                  }`}
                  onClick={() => handlePromptClick("Battery life comparison")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Battery life comparison
                      </h3>
                      <p className="text-sm text-gray-700">
                        Compare battery performance
                      </p>
                    </div>
                    {clickedPrompt === "Battery life comparison" && (
                      <div className="ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Modal for Home Page */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
          initialMode={authMode}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Desktop Sidebar */}
      {user && (
        <DesktopSidebar
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversationId || undefined}
          currentChatTitle={currentChatTitle}
          sidebarRef={sidebarRef}
        />
      )}

      {/* Mobile Sidebar */}
      {user && (
        <Sidebar
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversationId || undefined}
          currentChatTitle={currentChatTitle}
          sidebarRef={sidebarRef}
        />
      )}

      {/* Main Content */}
      <div className="lg:ml-80 flex flex-col min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b bg-white sticky top-0 z-10">
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user && (
              <button
                onClick={() => setShowSidebar(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            )}
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <span className="text-base sm:text-lg font-bold text-gray-900 tracking-wide font-inter">
              SmartPick AI
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {user ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 hidden sm:block">
                  Welcome, {user.username}
                </span>
                <div className="relative menu-container">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      {user ? (
                        <>
                          <button
                            onClick={handleGoHome}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                              />
                            </svg>
                            <span>Home</span>
                          </button>
                          <button
                            onClick={async () => {
                              await authService.signOut();
                              setUser(null);
                              handleGoHome();
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                              />
                            </svg>
                            <span>Sign Out</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setAuthMode("signin");
                              setShowAuthModal(true);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                              />
                            </svg>
                            <span>Sign In</span>
                          </button>
                          <button
                            onClick={() => {
                              setAuthMode("signup");
                              setShowAuthModal(true);
                              setShowMenu(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                              />
                            </svg>
                            <span>Sign Up</span>
                          </button>
                          <button
                            onClick={handleGoHome}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                              />
                            </svg>
                            <span>Home</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="relative menu-container">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={() => {
                          setAuthMode("signin");
                          setShowAuthModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                          />
                        </svg>
                        <span>Sign In</span>
                      </button>
                      <button
                        onClick={() => {
                          setAuthMode("signup");
                          setShowAuthModal(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                          />
                        </svg>
                        <span>Sign Up</span>
                      </button>
                      <button
                        onClick={handleGoHome}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                          />
                        </svg>
                        <span>Home</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={chatAreaRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 lg:px-16 xl:px-24 pt-4 sm:pt-6 pb-3 sm:pb-4 space-y-3 sm:space-y-4 scrollbar-hide"
        >
          {messages.map((message) => (
            <div key={message.id}>
              {editingMessageId === message.id ? (
                <div className="w-full">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full p-2 sm:p-3 bg-blue-50 text-blue-900 border border-blue-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base font-normal min-h-[80px] max-h-[200px] overflow-y-auto"
                    placeholder="Edit your message..."
                    autoFocus
                  />
                  <div className="flex items-center justify-end space-x-2 mt-2">
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-normal text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-all duration-200"
                    >
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-normal text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all duration-200"
                    >
                      <span>Save & Submit</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`${
                    message.role === "user"
                      ? "flex flex-col items-end"
                      : "flex flex-col items-start"
                  }`}
                >
                  <div
                    className={`${
                      message.role === "user"
                        ? "bg-blue-50 text-blue-900 border border-blue-200 rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 max-w-[85%] sm:max-w-md inline-block shadow-sm"
                        : "bg-white text-gray-900 rounded-2xl rounded-bl-md px-3 sm:px-4 py-2.5 sm:py-3 max-w-full inline-block"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      message.content ? (
                        <div>
                          <MarkdownRenderer content={message.content} />
                          <div className="flex items-center space-x-2 mt-2">
                            <button
                              onClick={() =>
                                handleCopyMessage(message.id, message.content)
                              }
                              className="flex items-center space-x-1.5 px-2 py-1 text-sm font-normal text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                              title="Copy response"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              <span
                                className={`${
                                  copiedMessageId === message.id
                                    ? "text-gray-600 font-semibold"
                                    : ""
                                }`}
                              >
                                {copiedMessageId === message.id
                                  ? "Copied!"
                                  : "Copy"}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                // Regenerate the last user message
                                const lastUserMessage = messages
                                  .slice(
                                    0,
                                    messages.findIndex(
                                      (m) => m.id === message.id
                                    )
                                  )
                                  .reverse()
                                  .find((m) => m.role === "user");
                                if (lastUserMessage) {
                                  handleRegenerateResponse(
                                    lastUserMessage.content
                                  );
                                }
                              }}
                              className="flex items-center space-x-1.5 px-2 py-1 text-sm font-normal text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                              title="Regenerate response"
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              <span>Try Again</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          <span className="text-sm sm:text-base text-gray-800 font-normal">
                            Thinking...
                          </span>
                        </div>
                      )
                    ) : (
                      <p className="text-sm sm:text-base whitespace-pre-wrap font-normal">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {message.role === "user" && editingMessageId !== message.id && (
                <div className="flex items-center justify-end space-x-1 sm:space-x-2 mt-2">
                  <button
                    onClick={() =>
                      handleCopyMessage(message.id, message.content)
                    }
                    className="flex items-center space-x-1 sm:space-x-1.5 px-2 py-1 text-xs sm:text-sm font-normal text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                    title="Copy message"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span
                      className={`${
                        copiedMessageId === message.id
                          ? "text-gray-600 font-semibold"
                          : ""
                      }`}
                    >
                      {copiedMessageId === message.id ? "Copied!" : "Copy"}
                    </span>
                  </button>
                  <button
                    onClick={() =>
                      handleEditMessage(message.id, message.content)
                    }
                    className="flex items-center space-x-1 sm:space-x-1.5 px-2 py-1 text-xs sm:text-sm font-normal text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                    title="Edit message"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    <span>Edit</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 sm:px-4 py-3 sm:py-4 bg-white sticky bottom-0 z-10 border-t">
          <div className="max-w-4xl mx-auto px-1 sm:px-2">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Message Shopping Agent..."
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="absolute right-1.5 sm:right-2 top-1/2 transform -translate-y-1/2 p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5-5 5M6 12h12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal for Chat Interface */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authMode}
      />
    </div>
  );
}
