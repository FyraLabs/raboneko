import client from '../client';
import { Events } from 'discord.js';
import { containsWord } from '../util';

client.on(Events.MessageCreate, async (message) => {
  if (message.author.id === message.client.user.id) return;
  if (containsWord(message, 'krane')) {
    await message.react('1233642528889245776');
  }
  if (containsWord(message, 'hayato')) {
    await message.react('1231664960032215070');
  }
  if (message.content.toLowerCase() == 'skull' || containsWord(message, 'skull\\s+emoji')) {
    await message.react('💀');
  }
  if (containsWord(message, 'good\\s+bot')) {
    await message.reply("thank nyu~")
  }
  if (containsWord(message, 'linux') && !containsWord(message, 'gnu/linux') && !containsWord(message, 'gnu+linux')) {
    await message.reply("I’d just like to interject for a moment. What you’re refering to as Linux, is in fact, GNU/LInux, or as I’ve recently taken to calling it, GNU plus Linux. Linux is not an operating system unto itself, but rather another free component of a fully functioning GNU system made useful by the GNU corelibs, shell utilities and vital system components comprising a full OS as defined by POSIX.\n\nMany computer users run a modified version of the GNU system every day, without realizing it. Through a peculiar turn of events, the version of GNU which is widely used today is often called “Linux”, and many of its users are not aware that it is basically the GNU system, developed by the GNU Project.\n\nThere really is a Linux, and these people are using it, but it is just a part of the system they use. Linux is the kernel: the program in the system that allocates the machine’s resources to the other programs that you run. The kernel is an essential part of an operating system, but useless by itself; it can only function in the context of a complete operating system. Linux is normally used in combination with the GNU operating system: the whole system is basically GNU with Linux added, or GNU/Linux. All the so-called “Linux” distributions are really distributions of GNU/Linux."
  }
});
