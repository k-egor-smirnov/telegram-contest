import folders_cat from '../assets/icons/folder/folders_cat.png';
import folders_cat_2x from '../assets/icons/folder/folders_cat@2x.png';
import folders_all from '../assets/icons/folder/ic_allchats.png';
import folders_all_2x from '../assets/icons/folder/ic_allchats@2x.png';
import folders_animal from '../assets/icons/folder/ic_animal.png';
import folders_animal_2x from '../assets/icons/folder/ic_animal@2x.png';
import folders_book from '../assets/icons/folder/ic_book.png';
import folders_book_2x from '../assets/icons/folder/ic_book@2x.png';
import folders_bot from '../assets/icons/folder/ic_bot.png';
import folders_bot_2x from '../assets/icons/folder/ic_bot@2x.png';
import folders_channel from '../assets/icons/folder/ic_channel.png';
import folders_channel_2x from '../assets/icons/folder/ic_channel@2x.png';
import folders_coin from '../assets/icons/folder/ic_coin.png';
import folders_coin_2x from '../assets/icons/folder/ic_coin@2x.png';
import folders_flash from '../assets/icons/folder/ic_flash.png';
import folders_flash_2x from '../assets/icons/folder/ic_flash@2x.png';
import folders_folder from '../assets/icons/folder/ic_folder.png';
import folders_folder_2x from '../assets/icons/folder/ic_folder@2x.png';
import folders_game from '../assets/icons/folder/ic_gamepad.png';
import folders_game_2x from '../assets/icons/folder/ic_gamepad@2x.png';
import folders_group from '../assets/icons/folder/ic_group.png';
import folders_group_2x from '../assets/icons/folder/ic_group@2x.png';
import folders_home from '../assets/icons/folder/ic_home.png';
import folders_home_2x from '../assets/icons/folder/ic_home@2x.png';
import folders_lamp from '../assets/icons/folder/ic_lamp.png';
import folders_lamp_2x from '../assets/icons/folder/ic_lamp@2x.png';
import folders_like from '../assets/icons/folder/ic_like.png';
import folders_like_2x from '../assets/icons/folder/ic_like@2x.png';
import folders_lock from '../assets/icons/folder/ic_lock.png';
import folders_lock_2x from '../assets/icons/folder/ic_lock@2x.png';
import folders_love from '../assets/icons/folder/ic_love.png';
import folders_love_2x from '../assets/icons/folder/ic_love@2x.png';
import folders_math from '../assets/icons/folder/ic_math.png';
import folders_math_2x from '../assets/icons/folder/ic_math@2x.png';
import folders_music from '../assets/icons/folder/ic_nusic.png';
import folders_music_2x from '../assets/icons/folder/ic_nusic@2x.png';
import folders_paint from '../assets/icons/folder/ic_paint.png';
import folders_paint_2x from '../assets/icons/folder/ic_paint@2x.png';
import folders_personal from '../assets/icons/folder/ic_personal.png';
import folders_personal_2x from '../assets/icons/folder/ic_personal@2x.png';
import folders_plane from '../assets/icons/folder/ic_plane.png';
import folders_plane_2x from '../assets/icons/folder/ic_plane@2x.png';
import folders_read from '../assets/icons/folder/ic_read.png';
import folders_read_2x from '../assets/icons/folder/ic_read@2x.png';
import folders_sport from '../assets/icons/folder/ic_sport.png';
import folders_sport_2x from '../assets/icons/folder/ic_sport@2x.png';
import folders_star from '../assets/icons/folder/ic_star.png';
import folders_star_2x from '../assets/icons/folder/ic_star@2x.png';
import folders_student from '../assets/icons/folder/ic_student.png';
import folders_student_2x from '../assets/icons/folder/ic_student@2x.png';
import folders_telegram from '../assets/icons/folder/ic_telegram.png';
import folders_telegram_2x from '../assets/icons/folder/ic_telegram@2x.png';
import folders_unmuted from '../assets/icons/folder/ic_unmuted.png';
import folders_unmuted_2x from '../assets/icons/folder/ic_unmuted@2x.png';
import folders_unread from '../assets/icons/folder/ic_unread.png';
import folders_unread_2x from '../assets/icons/folder/ic_unread@2x.png';
import folders_work from '../assets/icons/folder/ic_work.png';
import folders_work_2x from '../assets/icons/folder/ic_work@2x.png';

const FOLDER_ICONS_MAP: Record<string, [string, string]> = {
  '🐱': [folders_animal, folders_animal_2x],
  '📕': [folders_book, folders_book_2x],
  '💰': [folders_coin, folders_coin_2x],
  '📸': [folders_flash, folders_flash_2x],
  '🎮': [folders_game, folders_game_2x],
  '🏡': [folders_home, folders_home_2x],
  '💡': [folders_lamp, folders_lamp_2x],
  '👍': [folders_like, folders_like_2x],
  '🔒': [folders_lock, folders_lock_2x],
  '❤️': [folders_love, folders_love_2x],
  '➕': [folders_math, folders_math_2x],
  '🎵': [folders_music, folders_music_2x],
  '🎨': [folders_paint, folders_paint_2x],
  '✈️': [folders_plane, folders_plane_2x],
  '⚽️': [folders_sport, folders_sport_2x],
  '⭐': [folders_star, folders_star_2x],
  '🎓': [folders_student, folders_student_2x],
  '🛫': [folders_telegram, folders_telegram_2x],
  '👨‍💼': [folders_work, folders_work_2x],
  '👤': [folders_personal, folders_personal_2x],
  '👥': [folders_group, folders_group_2x],
  '💬': [folders_all, folders_all_2x],
  '✅': [folders_read, folders_read_2x],
  '☑️': [folders_unread, folders_unread_2x],
  '🤖': [folders_bot, folders_bot_2x],
  '🗂': [folders_folder, folders_folder_2x],
};

export function getFolderIconSrcByEmoji(emoji: string): string {
  return (FOLDER_ICONS_MAP[emoji] ?? FOLDER_ICONS_MAP['🗂'])[window.devicePixelRatio >= 1.5 ? 1 : 0];
}

export function getEnabledFolderIcons(): Array<keyof typeof FOLDER_ICONS_MAP> {
  return Object.keys(FOLDER_ICONS_MAP) as Array<keyof typeof FOLDER_ICONS_MAP>;
}
