import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Recall } from '../api/client';

interface Props {
  recall: Recall;
  onPress: () => void;
  highlight?: boolean;
}

export function RecallCard({ recall, onPress, highlight }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, highlight && styles.highlightCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {recall.image_url && (
          <Image source={{ uri: recall.image_url }} style={styles.thumbnail} />
        )}
        <View style={styles.textContent}>
          {/* Badges */}
          <View style={styles.badges}>
            <View style={[styles.badge, recall.status === 'active' ? styles.activeBadge : styles.resolvedBadge]}>
              <Text style={styles.badgeText}>
                {recall.status === 'active' ? 'Actif' : 'Résolu'}
              </Text>
            </View>
            {recall.is_infant_formula && (
              <View style={[styles.badge, styles.infantBadge]}>
                <Text style={styles.badgeText}>Lait infantile</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {recall.product_name}
          </Text>

          {/* Brand */}
          {recall.brand && (
            <Text style={styles.brand}>{recall.brand}</Text>
          )}

          {/* Reason */}
          {recall.reason && (
            <Text style={styles.reason} numberOfLines={1}>
              {recall.reason}
            </Text>
          )}

          {/* Date & Barcodes */}
          <View style={styles.meta}>
            <Text style={styles.date}>
              {new Date(recall.published_date).toLocaleDateString('fr-LU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            {recall.barcodes.length > 0 && (
              <Text style={styles.barcodeCount}>
                {recall.barcodes.length} code{recall.barcodes.length > 1 ? 's' : ''}-barres
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  highlightCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  cardContent: {
    flexDirection: 'row',
    padding: 12,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F0F0F0',
  },
  textContent: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activeBadge: {
    backgroundColor: '#F8D7DA',
  },
  resolvedBadge: {
    backgroundColor: '#E2E3E5',
  },
  infantBadge: {
    backgroundColor: '#FFF3CD',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 20,
  },
  brand: {
    fontSize: 13,
    color: '#0068B4',
    fontWeight: '500',
    marginTop: 2,
  },
  reason: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  date: {
    fontSize: 11,
    color: '#AAA',
  },
  barcodeCount: {
    fontSize: 11,
    color: '#0068B4',
  },
});
