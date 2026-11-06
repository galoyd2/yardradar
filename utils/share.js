// utils/share.js
// Opens the phone's share sheet (Facebook, Instagram, Messages, email, etc.)
import { Share, Alert } from 'react-native';

function mapsLink(sale) {
  if (sale.coordinates) {
    const { latitude, longitude } = sale.coordinates;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sale.location || '')}`;
}

function whenText(sale) {
  const d = sale.saleTimestamp?.toDate?.();
  if (!d) return '';
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}

export function buildShareMessage(sale) {
  const lines = [`🏷️ Yard sale: ${sale.title}`];
  const when = whenText(sale);
  if (when) lines.push(`📅 ${when}`);
  if (sale.location) lines.push(`📍 ${sale.location}`);
  if (sale.description) lines.push('', sale.description.trim());
  lines.push('', `Directions: ${mapsLink(sale)}`);
  lines.push('', 'Found on YardRadar');
  return lines.join('\n');
}

export async function shareSale(sale) {
  try {
    await Share.share(
      {
        title: sale.title, // used as the subject line in email apps
        message: buildShareMessage(sale),
      },
      { dialogTitle: 'Share this yard sale', subject: `Yard sale: ${sale.title}` }
    );
  } catch (err) {
    console.error('Share failed:', err);
    Alert.alert('Error', 'Could not open the share menu.');
  }
}
