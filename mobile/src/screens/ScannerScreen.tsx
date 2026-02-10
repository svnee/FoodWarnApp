import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, BarcodeCheckResult } from '../api/client';
import { RecallCard } from '../components/RecallCard';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<BarcodeCheckResult | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: BarCodeScannerResult) => {
    if (scanned || checking) return;
    setScanned(true);
    setChecking(true);

    try {
      const checkResult = await api.checkBarcode(data);
      setResult(checkResult);
    } catch (err) {
      Alert.alert(
        'Erreur',
        'Impossible de vérifier ce code-barres. Vérifiez votre connexion internet.'
      );
      setScanned(false);
    } finally {
      setChecking(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setResult(null);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0068B4" />
        <Text style={styles.infoText}>Demande d'accès à la caméra...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>Accès caméra requis</Text>
        <Text style={styles.infoText}>
          FoodWarnLux a besoin d'accéder à votre caméra pour scanner les codes-barres des produits.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => BarCodeScanner.requestPermissionsAsync()}>
          <Text style={styles.primaryButtonText}>Autoriser l'accès</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show results after scan
  if (scanned && result) {
    return (
      <ScrollView style={styles.resultsContainer}>
        {/* Result Header */}
        <View style={[styles.resultHeader, result.found ? styles.dangerHeader : styles.safeHeader]}>
          <Text style={styles.resultIcon}>{result.found ? '⚠️' : '✅'}</Text>
          <Text style={styles.resultTitle}>
            {result.found
              ? 'PRODUIT RAPPELÉ !'
              : 'Aucun rappel trouvé'}
          </Text>
          {result.product && (
            <Text style={styles.resultProduct}>
              {result.product.product_name || 'Produit inconnu'}
              {result.product.brand ? ` — ${result.product.brand}` : ''}
            </Text>
          )}
        </View>

        {/* Recalled products */}
        {result.found && result.recalls.length > 0 && (
          <View style={styles.recallsSection}>
            <Text style={styles.sectionTitle}>
              Rappels associés ({result.recalls.length})
            </Text>
            {result.recalls.map(recall => (
              <RecallCard
                key={recall.id}
                recall={recall}
                onPress={() => navigation.navigate('RecallDetail', { id: recall.id })}
              />
            ))}
          </View>
        )}

        {/* Product info */}
        {!result.found && result.product && (
          <View style={styles.productInfo}>
            <Text style={styles.sectionTitle}>Informations produit</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nom:</Text>
              <Text style={styles.infoValue}>{result.product.product_name || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Marque:</Text>
              <Text style={styles.infoValue}>{result.product.brand || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Catégories:</Text>
              <Text style={styles.infoValue}>{result.product.categories || '—'}</Text>
            </View>
          </View>
        )}

        {!result.product && !result.found && (
          <View style={styles.productInfo}>
            <Text style={styles.unknownText}>
              Ce produit n'est pas dans notre base de données. Il n'a pas fait l'objet d'un rappel connu.
            </Text>
          </View>
        )}

        {/* Scan again button */}
        <TouchableOpacity style={styles.primaryButton} onPress={resetScanner}>
          <Text style={styles.primaryButtonText}>Scanner un autre produit</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Camera scanner view
  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
        barCodeTypes={[
          BarCodeScanner.Constants.BarCodeType.ean13,
          BarCodeScanner.Constants.BarCodeType.ean8,
          BarCodeScanner.Constants.BarCodeType.upc_a,
          BarCodeScanner.Constants.BarCodeType.upc_e,
        ]}
      />

      {/* Overlay with scan guide */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.scanText}>
            Placez le code-barres dans le cadre
          </Text>
          {checking && (
            <View style={styles.checkingContainer}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.checkingText}>Vérification en cours...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const SCAN_SIZE = 280;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F5F6FA',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: SCAN_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scanArea: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 30,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#0068B4',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  checkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkingText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
  },
  // Results
  resultsContainer: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  resultHeader: {
    padding: 24,
    alignItems: 'center',
  },
  dangerHeader: {
    backgroundColor: '#DC3545',
  },
  safeHeader: {
    backgroundColor: '#28A745',
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  resultProduct: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  recallsSection: {
    padding: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  productInfo: {
    margin: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoLabel: {
    width: 100,
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  unknownText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#0068B4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    margin: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
