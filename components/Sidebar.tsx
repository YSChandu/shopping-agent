"use client";

import { useState, useEffect, useCallback } from "react";
import { authService, Conversation } from "../services/authService";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
  currentChatTitle?: string;
  sidebarRef?: React.RefObject<HTMLDivElement | null>;
}

export default function Sidebar({
  isOpen,
  onClose,
  onNewChat,
  onSelectConversation,
  currentConversationId,
  currentChatTitle,
  sidebarRef,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {

    setIsLoading(true);
    try {
      const userConversations = await authService.getUserConversations();
     

      // If there's a current conversation that's not in the list, add it
      if (currentConversationId && currentChatTitle) {
        const existingConversation = userConversations.find(
          (conv) => conv.id === currentConversationId
        );
       

        if (!existingConversation) {
          // Add current chat to the list
          const currentChat: Conversation = {
            id: currentConversationId,
            user_id: "", // Will be filled by the backend
            title: currentChatTitle,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          userConversations.unshift(currentChat); // Add to beginning
        } else {
          console.log("MobileSidebar: Current conversation already in list");
        }
      }

     

      // Check for duplicates
      const convIds = userConversations.map((c) => c.id);
      const uniqueConvIds = [...new Set(convIds)];
     

      setConversations(userConversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, currentChatTitle]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  const handleDeleteConversation = async (
    conversationId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    setDeletingId(conversationId);
    try {
      const success = await authService.deleteConversation(conversationId);
      if (success) {
        setConversations((prev) =>
          prev.filter((conv) => conv.id !== conversationId)
        );
        // If we're deleting the current conversation, go to home
        if (currentConversationId === conversationId) {
          onNewChat();
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return "Today";
    } else if (diffDays === 2) {
      return "Yesterday";
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Helper function to extract clean title without timestamp
  const getCleanTitle = (title: string | null) => {
    if (!title) return "New Chat";


    // Remove any content between parentheses at the end of the title
    // This handles timestamps like: (09/10/2025, 15:54:47)
    const cleanTitle = title.replace(/\s*\([^)]*\)$/, "");


    return cleanTitle.length > 30
      ? cleanTitle.substring(0, 30) + "..."
      : cleanTitle;
  };

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      } transition-opacity duration-300`}
    >
      {/* Transparent overlay for closing */}
      <div
        className={`fixed inset-0 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b flex-shrink-0">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white text-blue-600 rounded-lg  transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New Chat</span>
          </button>
        </div>

        {/* Conversations List */}
        <div
          ref={sidebarRef}
          className="flex-1 overflow-y-auto min-h-0 scrollbar-hide"
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-4 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p>No conversations yet</p>
              <p className="text-sm">Start a new chat to begin!</p>
            </div>
          ) : (
            <div className="p-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => {
                   
                    onSelectConversation(conversation.id);
                    onClose();
                  }}
                  className={`group relative p-2 rounded-lg cursor-pointer transition-colors mb-1 ${
                    currentConversationId === conversation.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {getCleanTitle(conversation.title)}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(conversation.updated_at)}
                      </p>
                    </div>

                    <button
                      onClick={(e) =>
                        handleDeleteConversation(conversation.id, e)
                      }
                      disabled={deletingId === conversation.id}
                      className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-600 transition-all duration-200 disabled:opacity-50"
                    >
                      {deletingId === conversation.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0">
          {/* User Info */}
          <div className="mb-3 px-3 py-2 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700 truncate">
                {authService.getCurrentUserSync()?.username || "Guest"}
              </span>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={async () => {
              await authService.signOut();
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
