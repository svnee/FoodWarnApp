import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { api, Recall } from '../api/client';
import { RootStackParamList } from '../navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'RecallDetail'>;

export function RecallDetailScreen() {
  const route = useRoute<RouteProps>();
  const { id } = route.params;
  const [recall, setRecall] = useState<Recall | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRecall(id)
      .then(setRecall)
      .catch(err => console.error('Error fetching recall:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0068B4" />
      </View>
    );
  }

  if (!recall) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Rappel non trouvé</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Status Header */}
      <View style={[styles.statusBanner, recall.status === 'active' ? styles.activeBanner : styles.resolvedBanner]}>
        <Text style={styles.statusText}>
          {recall.status === 'active' ? 'RAPPEL ACTIF' : 'RÉSOLU'}
        </Text>
        {recall.is_infant_formula && (
          <View style={styles.infantBadge}>
            <Text style={styles.infantBadgeText}>Lait infantile</Text>
          </View>
        )}
      </View>

      {/* Product Image */}
      {recall.image_url && (
        <Image
          source={{ uri: recall.image_url }}
          style={styles.productImage}
          resizeMode="contain"
        />
      )}

      {/* Title & Meta */}
      <View style={styles.section}>
        <Text style={styles.title}>{recall.title}</Text>
        <Text style={styles.date}>
          Publié le {new Date(recall.published_date).toLocaleDateString('fr-LU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Text>
      </View>

      {/* Product Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Détails du produit</Text>
        <DetailRow label="Produit" value={recall.product_name} />
        <DetailRow label="Marque" value={recall.brand} />
        <DetailRow label="Motif" value={recall.reason} />
        <DetailRow label="N° de lot" value={recall.lot_numbers} />
        <DetailRow label="Date de péremption" value={recall.expiry_dates} />
      </View>

      {/* Barcodes */}
      {recall.barcodes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Codes-barres associés</Text>
          {recall.barcodes.map(bc => (
            <View key={bc.id} style={styles.barcodeRow}>
              <Text style={styles.barcodeText}>{bc.barcode}</Text>
              <View style={[
                styles.confidenceBadge,
                bc.confidence >= 0.8 ? styles.highConfidence :
                bc.confidence >= 0.5 ? styles.medConfidence : styles.lowConfidence
              ]}>
                <Text style={styles.confidenceText}>
                  {bc.source === 'manual' ? 'Manuel' :
                   bc.source === 'scraped' ? 'Officiel' :
                   `${Math.round(bc.confidence * 100)}%`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Description */}
      {recall.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description complète</Text>
          <Text style={styles.description}>{recall.description}</Text>
        </View>
      )}

      {/* Source link */}
      <TouchableOpacity
        style={styles.sourceButton}
        onPress={() => Linking.openURL(recall.source_url)}
      >
        <Text style={styles.sourceButtonText}>Voir sur securite-alimentaire.lu</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  activeBanner: {
    backgroundColor: '#DC3545',
  },
  resolvedBanner: {
    backgroundColor: '#6C757D',
  },
  statusText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  infantBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  infantBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  productImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 26,
  },
  date: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    width: 120,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  barcodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  barcodeText: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#333',
    fontWeight: '600',
  },
  confidenceBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  highConfidence: {
    backgroundColor: '#D4EDDA',
  },
  medConfidence: {
    backgroundColor: '#FFF3CD',
  },
  lowConfidence: {
    backgroundColor: '#F8D7DA',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  sourceButton: {
    margin: 16,
    backgroundColor: '#0068B4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sourceButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  bottomPadding: {
    height: 30,
  },
});
