'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  Sidebar,
  Search,
  ConversationList,
  Conversation,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  Avatar,
  TypingIndicator,
  MessageSeparator,
} from '@chatscope/chat-ui-kit-react';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';

// Import styles if not globally imported
// Note: In Next.js App Router, global styles should be in layout, but component-level imports might work depending on config.
// If this fails, we'll move it to layout.

interface ChatInterfaceProps {
  tenantId: string;
}

interface Channel {
  id: number;
  channelType: string;
  externalUserId: string;
  hubspotContactId: string;
  messages: any[];
  updatedAt: string;
}

interface ChatMessage {
  id: number;
  content: string;
  isFromUser: boolean; // true = from Line user, false = from System/HubSpot
  createdAt: string;
  direction: 'incoming' | 'outgoing';
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ tenantId }) => {
  const { socket } = useSocket();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch Channels
  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const res = await axios.get(`/api/chat/channels?tenantId=${tenantId}`);
        setChannels(res.data);
      } catch (err) {
        console.error('Failed to fetch channels', err);
      }
    };
    fetchChannels();
  }, [tenantId]);

  // Fetch Messages when channel changes
  useEffect(() => {
    if (!activeChannelId) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/chat/messages/${activeChannelId}?tenantId=${tenantId}`);
        const mappedMessages = res.data.map((msg: any) => ({
          ...msg,
          direction: msg.isFromUser ? 'incoming' : 'outgoing', // Incoming = from Line User
        }));
        setMessages(mappedMessages);
        
        // Join channel room
        socket?.emit('join', `channel_${activeChannelId}`);
      } catch (err) {
        console.error('Failed to fetch messages', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    return () => {
      socket?.emit('leave', `channel_${activeChannelId}`);
    };
  }, [activeChannelId, tenantId, socket]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: any) => {
      if (event.event === 'message.created') {
        const newMsg = event.data;
        // Only append if it belongs to current channel
        if (newMsg.channelId === activeChannelId) {
           setMessages((prev) => [
            ...prev,
            {
              ...newMsg,
              direction: newMsg.isFromUser ? 'incoming' : 'outgoing',
            },
          ]);
        }
        
        // Refresh channel list to show latest message/unread (simplified)
        // In a real app, update the specific channel in the list
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
    };
  }, [socket, activeChannelId]);

  const handleSend = async (text: string) => {
    if (!activeChannelId) return;
    setSending(true);

    // Optimistic update
    const tempId = Date.now();
    const optimisticMsg: ChatMessage = {
      id: tempId,
      content: text,
      isFromUser: false,
      createdAt: new Date().toISOString(),
      direction: 'outgoing',
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await axios.post('/api/chat/messages', {
        tenantId,
        channelId: activeChannelId,
        content: text,
      });
      // Real message will arrive via socket or we can replace the optimistic one
    } catch (err) {
      console.error('Failed to send message', err);
      // Remove optimistic message or show error
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '600px', overflow: 'hidden' }}>
      <MainContainer>
        <Sidebar position="left" scrollable={false}>
          <Search placeholder="Search..." />
          <ConversationList>
            {channels.map((c) => (
              <Conversation
                key={c.id}
                name={c.externalUserId} // Or fetch display name
                info={c.messages[0]?.content || 'No messages'}
                active={activeChannelId === c.id}
                onClick={() => setActiveChannelId(c.id)}
              >
                <Avatar src={`https://ui-avatars.com/api/?name=${c.externalUserId}`} />
              </Conversation>
            ))}
          </ConversationList>
        </Sidebar>

        <ChatContainer>
          <MessageList typingIndicator={sending ? <TypingIndicator content="Sending..." /> : null}>
            {messages.map((m) => (
              <Message
                key={m.id}
                model={{
                  message: m.content,
                  sentTime: m.createdAt,
                  sender: m.direction === 'incoming' ? 'User' : 'Me',
                  direction: m.direction,
                  position: 'single',
                }}
              />
            ))}
          </MessageList>
          <MessageInput placeholder="Type message here" onSend={handleSend} disabled={!activeChannelId} />
        </ChatContainer>
      </MainContainer>
    </div>
  );
};
