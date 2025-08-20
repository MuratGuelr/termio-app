import React, { useMemo, useState, useCallback } from 'react';
import { useGamification } from '../../contexts/GamificationContext.jsx';
import './DecorShopModal.css';

// Simple starter catalog
const CATALOG = [
  { id: 'bench_1', name: 'Bahçe Bankı', price: 150, icon: '🪑', type: 'bench' },
  { id: 'lamp_1', name: 'Sokak Lambası', price: 200, icon: '💡', type: 'lamp' },
  { id: 'tree_1', name: 'Küçük Ağaç', price: 250, icon: '🌳', type: 'tree' },
  { id: 'fence_1', name: 'Çit Parçası', price: 80, icon: '🪵', type: 'fence' }
];

export default function DecorShopModal({ open, onClose }) {
  const { userStats, spendXP, addDecorToInventory, placeDecor } = useGamification();
  const [tab, setTab] = useState('shop'); // shop | inventory | scene
  const [selectedForPlace, setSelectedForPlace] = useState(null);

  const inventory = userStats?.decor?.inventory || [];
  const placed = userStats?.decor?.placed || [];
  const xp = userStats?.xp || 0;

  const ownedIds = useMemo(() => new Set(inventory.map(i => i.id)), [inventory]);

  const handleBuy = useCallback(async (item) => {
    const ok1 = await spendXP(item.price);
    if (!ok1.ok) {
      alert('XP yetersiz.');
      return;
    }
    await addDecorToInventory(item);
  }, [spendXP, addDecorToInventory]);

  const handleSceneClick = useCallback(async (e) => {
    if (!selectedForPlace) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    await placeDecor(selectedForPlace.id, Math.round(xPct), Math.round(yPct));
    setSelectedForPlace(null);
  }, [selectedForPlace, placeDecor]);

  if (!open) return null;

  return (
    <div className="decor-modal-overlay" role="dialog" aria-modal="true">
      <div className="decor-modal">
        <div className="decor-modal__header">
          <div className="decor-modal__title">
            <i className="fas fa-gamepad"></i> Dekor Mağazası
          </div>
          <div className="decor-modal__xp">XP: {xp}</div>
          <button className="decor-modal__close" onClick={onClose} aria-label="Kapat">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="decor-tabs">
          <button className={`decor-tab ${tab==='shop'?'active':''}`} onClick={() => setTab('shop')}>Mağaza</button>
          <button className={`decor-tab ${tab==='inventory'?'active':''}`} onClick={() => setTab('inventory')}>Envanter</button>
          <button className={`decor-tab ${tab==='scene'?'active':''}`} onClick={() => setTab('scene')}>Sahne</button>
        </div>

        {tab === 'shop' && (
          <div className="decor-shop">
            {CATALOG.map(item => (
              <div key={item.id} className="decor-item">
                <div className="decor-item__icon">{item.icon}</div>
                <div className="decor-item__meta">
                  <div className="decor-item__name">{item.name}</div>
                  <div className="decor-item__price">{item.price} XP</div>
                </div>
                {ownedIds.has(item.id) ? (
                  <span className="decor-item__owned">Sahipsin</span>
                ) : (
                  <button className="decor-item__buy" onClick={() => handleBuy(item)} disabled={xp < item.price}>
                    Satın Al
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="decor-inventory">
            {inventory.length === 0 && <div className="decor-empty">Envanter boş</div>}
            {inventory.map(item => (
              <div key={item.id} className={`decor-item ${selectedForPlace?.id===item.id?'selected':''}`} onClick={() => setSelectedForPlace(item)}>
                <div className="decor-item__icon">{item.icon}</div>
                <div className="decor-item__meta">
                  <div className="decor-item__name">{item.name}</div>
                  <div className="decor-item__hint">Yerleştirmek için Sahne sekmesine geç</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'scene' && (
          <div className="decor-scene">
            <div className="decor-scene__toolbar">
              <span>{selectedForPlace ? `Seçili: ${selectedForPlace.name}` : 'Önce envanterden bir öğe seç'}</span>
            </div>
            <div className="decor-scene__canvas" onClick={handleSceneClick}>
              {/* Background */}
              <div className="decor-bg" />
              {/* Placed items */}
              {placed.map((p, idx) => {
                const item = inventory.find(i => i.id === p.id);
                if (!item) return null;
                return (
                  <div key={idx} className="decor-placed" style={{ left: `${p.x}%`, top: `${p.y}%` }} title={item.name}>
                    {item.icon}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
