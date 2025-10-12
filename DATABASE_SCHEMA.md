# Database Schema Documentation

## Overview

This document describes the database schema for the Shopping Agent application, including table definitions, relationships, and data flow.

## Tables

### A) user_profile

**Purpose**: Stores user accounts with unique usernames and passwords.

| Column     | Type        | Notes                              |
| ---------- | ----------- | ---------------------------------- |
| id         | uuid        | Primary key, auto-generated        |
| username   | text        | Unique username                    |
| password   | text        | Hashed password (never plain text) |
| created_at | timestamptz | Default now()                      |

**SQL**:

```sql
create extension if not exists "pgcrypto";

create table user_profile (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  created_at timestamptz default now()
);
```

### B) conversations

**Purpose**: Stores separate chat threads for each user.

| Column     | Type        | Notes                                       |
| ---------- | ----------- | ------------------------------------------- |
| id         | uuid        | Primary key                                 |
| user_id    | uuid        | Foreign key to user_profile.id              |
| title      | text        | Optional: auto-generated from first message |
| created_at | timestamptz | Default now()                               |
| updated_at | timestamptz | Updated when a new message is added         |

**SQL**:

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profile(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Trigger to auto-update updated_at on new message**:

```sql
create function update_conversation_updated_at() returns trigger as $$
begin
  update conversations set updated_at = now() where id = NEW.conversation_id;
  return NEW;
end;
$$ language plpgsql;
```

### C) chat_messages

**Purpose**: Stores messages (user & assistant) linked to a conversation.

| Column          | Type        | Notes                                           |
| --------------- | ----------- | ----------------------------------------------- |
| id              | uuid        | Primary key                                     |
| conversation_id | uuid        | Foreign key to conversations.id                 |
| user_id         | uuid        | Foreign key to user_profile.id (message sender) |
| role            | text        | 'user' or 'assistant'                           |
| content         | text        | Message text                                    |
| created_at      | timestamptz | Default now()                                   |

**SQL**:

```sql
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references user_profile(id) on delete cascade,
  role text check (role in ('user','assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

create trigger trg_update_conversation_updated_at
  after insert on chat_messages
  for each row execute procedure update_conversation_updated_at();
```

## Working Flow

### 1. User Signup/Login

- User creates account → inserted into `user_profile`
- Authentication handled via username + password (hashed with bcrypt)

### 2. Start a New Conversation

- User clicks "New Chat" → insert new row in `conversations` with `user_id`
- Returns `conversation_id` for messages

### 3. User Sends a Message

- Insert message into `chat_messages` with:
  - `conversation_id`
  - `user_id`
  - `role = 'user'`
  - `content = <user query>`

### 4. AI Generates a Reply

- Backend reads chat history for context from `chat_messages`
- Calls AI model to get reply
- Inserts assistant reply in `chat_messages` with `role = 'assistant'`

### 5. Update Conversation Metadata

- Trigger auto-updates `conversations.updated_at`
- Optional: generate a short title from first user message

### 6. Display Chat Threads

- Fetch all conversations for user from DB
- Show title + last message preview + last updated time

### 7. Display Chat History

- Fetch all `chat_messages` for a `conversation_id`
- Show messages in chronological order with role distinction

### 8. Optional Operations

- Rename conversation → update `conversations.title`
- Delete conversation → cascade deletes all messages
- Each user only accesses their own threads via RLS policies

## Summary

- `user_profile` → stores users
- `conversations` → stores threads
- `chat_messages` → stores messages in threads

**Flow**: signup → new conversation → user message → AI reply → display threads & history

## Authentication

- Custom authentication system using `user_profile` table
- Passwords hashed with bcrypt (12 salt rounds)
- No email required - username + password only
- Session management handled in frontend state
