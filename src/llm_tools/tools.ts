import { tool, ToolSet } from 'ai';
import { z } from 'zod';
import parse from 'parse-duration';
import { client } from '../prisma';
import { reminderQueue } from '../scheduler';
import { messageLink } from 'discord.js';

export interface DiscordToolContext {
  channelId: string;
  userId: string;
  guildId?: string;
  messageId?: string;
}

export function toolSet(): ToolSet {
  const reminderTool = tool({
    description: 'Set a reminder for the user at a specified time with a message.',
    inputSchema: z.object({
      time: z
        .string()
        .describe(
          'Duration from now when the reminder should occur (e.g., "10s", "5m", "2h", "1d").',
        ),
      message: z.string().describe('The content of the reminder message.'),
    }),
    execute: async (args, options) => {
      const context = options?.experimental_context as DiscordToolContext | undefined;
      if (!context?.channelId || !context?.userId) {
        return {
          success: false,
          error: 'Missing Discord context for reminder tool execution.',
        };
      }

      const { channelId, guildId, messageId, userId } = context;

      try {
        // Parse the time duration
        const delay = parse(args.time);
        if (typeof delay !== 'number') {
          return {
            success: false,
            error: 'Invalid time format. Please use formats like "10s", "5m", "2h", "1d".',
          };
        }

        // Calculate the future time
        const reminderTime = new Date(Date.now() + delay);

        // Create the message link
        const link = messageId
          ? guildId
            ? messageLink(channelId, messageId, guildId)
            : messageLink(channelId, messageId)
          : `https://discord.com/channels/${guildId || '@me'}/${channelId}`;

        // Create the reminder in the database
        const reminder = await client.reminder.create({
          data: {
            userID: userId,
            channelID: channelId,
            content: args.message,
            time: reminderTime,
            link: link,
          },
        });

        // Add to the reminder queue
        await reminderQueue.add('reminder', { id: reminder.id }, { delay });

        return {
          success: true,
          userId: userId,
          reminderId: reminder.id,
          reminderTime: reminderTime.toISOString(),
          message: `Reminder set for <t:${Math.trunc(reminderTime.getTime() / 1000)}:R> to "${args.message}"`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create reminder: ${(error as Error).message}`,
        };
      }
    },
  });

  console.debug('Tool created:', {
    description: reminderTool.description,
    hasExecute: !!reminderTool.execute,
    hasInputSchema: !!reminderTool.inputSchema,
  });

  return {
    reminders: reminderTool,
  };
}
