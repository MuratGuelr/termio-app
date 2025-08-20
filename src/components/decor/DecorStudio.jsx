import { useEffect, useRef, useState } from 'react';
import { useGamification } from '../../contexts/GamificationContext.jsx';
import { useToast } from '../notifications/ToastContainer.jsx';
import './DecorStudio.css';
// Image assets for exterior visuals
import exteriorBg from '../../assets/decor/exterior_bg.svg';
import interiorBg from '../../assets/decor/interior_bg.svg';
import poolImg from '../../assets/decor/pool.svg';
import treeImg from '../../assets/decor/tree.svg';
import flowerbedImg from '../../assets/decor/flowerbed.svg';
import lightImg from '../../assets/decor/garden_light.svg';
import fenceImg from '../../assets/decor/fence.svg';
// Interior item images
import sofaImg from '../../assets/decor/sofa.svg';
import tableImg from '../../assets/decor/table.svg';
import plantImg from '../../assets/decor/plant.svg';
import tvImg from '../../assets/decor/tv.svg';

export default function DecorStudio() {
  const { userStats, purchaseLand, buildHouseStage, addDecorToInventory, placeDecor, removeDecor, spendXP, updateDecorScale } = useGamification();
  const { addToast, ToastContainer } = useToast();
  
  const [currentView, setCurrentView] = useState('exterior'); // 'exterior' or 'interior'
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  
  const canvasRef = useRef(null);
  
  // Get current area data based on view
  const currentArea = currentView === 'interior' ? 'interiorDecor' : 'exteriorDecor';
  const inventory = userStats?.house?.[currentArea]?.inventory || [];
  const placed = userStats?.house?.[currentArea]?.placed || [];

  // Helpers to check ownership/placement
  const isInInventory = (id) => inventory.some(i => i.id === id);
  const isPlaced = (id) => placed.some(p => p.id === id);

  // Item -> image mapping for previews and canvas
  const getItemImage = (id) => {
    switch (id) {
      case 'pool': return poolImg;
      case 'tree': return treeImg;
      case 'flower': return flowerbedImg;
      case 'garden_light': return lightImg;
      case 'fence': return fenceImg;
      // interior
      case 'sofa': return sofaImg;
      case 'table': return tableImg;
      case 'plant': return plantImg;
      case 'tv': return tvImg;
      default: return null;
    }
  };

  // Heuristic auto-placement for exterior items so they look natural
  const getAutoPlacement = (itemId, rect) => {
    // defaults: center
    let x = Math.round(rect.width / (2 * zoom) - 24);
    let y = Math.round(rect.height / (2 * zoom) - 24);
    if (currentView === 'exterior') {
      const W = rect.width / zoom;
      const H = rect.height / zoom;
      // approximate ground baseline (where items should sit) as a proportion of canvas height
      const groundY = Math.round(H * 0.82);
      switch (itemId) {
        case 'fence': {
          // fence is absolutely positioned via CSS; x/y not used visually, but keep near left
          x = Math.round(W * 0.05);
          y = groundY - 24; // not used; placeholder
          break;
        }
        case 'pool': {
          const poolW = 130, poolH = 78; // match CSS
          x = Math.round(W * 0.14);
          y = groundY - poolH + 6; // slight sink
          break;
        }
        case 'tree': {
          const treeH = 86;
          x = Math.round(W * 0.78);
          y = groundY - treeH + 4;
          break;
        }
        case 'flower': {
          const flowerH = 28;
          x = Math.round(W * 0.30);
          y = groundY - flowerH + 2;
          break;
        }
        case 'garden_light': {
          const lightH = 48;
          x = Math.round(W * 0.58);
          y = groundY - lightH + 2;
          break;
        }
        default:
          break;
      }
    } else if (currentView === 'interior') {
      const W = rect.width / zoom;
      const H = rect.height / zoom;
      const floorY = Math.round(H - 160); // interior floor baseline
      switch (itemId) {
        case 'sofa': {
          const w = 200, h = 120;
          const xPos = Math.round(W * 0.25);
          const yPos = floorY - h + 40;
          x = xPos; y = yPos;
          break;
        }
        case 'table': {
          const w = 160, h = 120;
          const xPos = Math.round(W * 0.58);
          const yPos = floorY - h + 48;
          x = xPos; y = yPos;
          break;
        }
        case 'plant': {
          const w = 120, h = 160;
          const xPos = Math.round(W * 0.12);
          const yPos = floorY - h + 32;
          x = xPos; y = yPos;
          break;
        }
        case 'tv': {
          const w = 180, h = 120;
          const xPos = Math.round(W * 0.70);
          const yPos = floorY - h + 30;
          x = xPos; y = yPos;
          break;
        }
        default:
          break;
      }
    }
    return { x, y };
  };
  
  // House building stages
  const buildingStages = {
    none: { name: 'Arsa Yok', next: 'land', cost: 500, action: 'purchaseLand' },
    land: { name: 'Arsa Satın Alındı', next: 'foundation', cost: 300, action: 'buildStage' },
    foundation: { name: 'Temel Atıldı', next: 'walls', cost: 400, action: 'buildStage' },
    walls: { name: 'Duvarlar Yapıldı', next: 'roof', cost: 350, action: 'buildStage' },
    roof: { name: 'Çatı İnşa Edildi', next: 'completed', cost: 0, action: null },
    completed: { name: 'Ev Tamamlandı', next: null, cost: 0, action: null }
  };
  
  // Shop items based on current context
  const getShopItems = () => {
    const house = userStats?.house;
    if (!house?.landPurchased) return [];
    
    if (house.buildingStage === 'completed') {
      // Show decor items based on current view
      if (currentView === 'exterior') {
        return [
          { id: 'tree', name: 'Ağaç', icon: '🌳', price: 80, category: 'bitki', size: 'large', area: 'exterior' },
          { id: 'flower', name: 'Çiçek', icon: '🌸', price: 40, category: 'bitki', size: 'small', area: 'exterior' },
          { id: 'fence', name: 'Çit', icon: '🚧', price: 120, category: 'yapı', size: 'medium', area: 'exterior' },
          { id: 'garden_light', name: 'Bahçe Lambası', icon: '💡', price: 90, category: 'ışık', size: 'small', area: 'exterior' },
          { id: 'pool', name: 'Havuz', icon: '🏊‍♂️', price: 220, category: 'yapı', size: 'large', area: 'exterior' }
        ];
      } else {
        return [
          { id: 'sofa', name: 'Kanepe', icon: '🛋️', price: 180, category: 'mobilya', size: 'large', area: 'interior' },
          { id: 'table', name: 'Masa', icon: '🪑', price: 120, category: 'mobilya', size: 'medium', area: 'interior' },
          { id: 'plant', name: 'Saksı Bitkisi', icon: '🪴', price: 60, category: 'bitki', size: 'small', area: 'interior' },
          { id: 'tv', name: 'Televizyon', icon: '📺', price: 250, category: 'elektronik', size: 'medium', area: 'interior' }
        ];
      }
    }
    return [];
  };
  
  const shopItems = getShopItems();
  const categories = [
    { id: 'all', label: 'Tümü' },
    { id: 'bitki', label: 'Bitkiler' },
    { id: 'mobilya', label: 'Mobilya' },
    { id: 'ışık', label: 'Aydınlatma' },
    { id: 'yapı', label: 'Yapı' },
    { id: 'elektronik', label: 'Elektronik' }
  ];

  useEffect(() => {
    document.title = 'Dekor Stüdyosu | Termio';
    return () => { document.title = 'Termio'; };
  }, []);

  const goBack = () => {
    // Use router history if available; fallback to root
    if (window.history.length > 1) window.history.back();
    else window.location.href = '/';
  };

  const getItemMeta = (id) => inventory.find(i => i.id === id) || shopItems.find(i => i.id === id) || {};
  
  const handleBuildingAction = async (action, stage) => {
    try {
      let result;
      if (action === 'purchaseLand') {
        result = await purchaseLand();
      } else if (action === 'buildStage') {
        result = await buildHouseStage(stage);
      }
      
      if (!result?.ok) {
        console.error('Building action failed:', result?.reason);
        switch (result?.reason) {
          case 'insufficient_xp':
            addToast('Yetersiz XP! Daha fazla görev tamamlayın.', 'error');
            break;
          case 'already_purchased':
            addToast('Arsa zaten satın alınmış!', 'warning');
            break;
          case 'wrong_order':
            addToast('İnşaat aşamaları sırayla yapılmalı!', 'warning');
            break;
          case 'no_land':
            addToast('Önce arsa satın almalısınız!', 'warning');
            break;
          default:
            addToast('Bir hata oluştu. Tekrar deneyin.', 'error');
        }
      } else {
        // Success messages
        if (action === 'purchaseLand') {
          addToast('🏞️ Arsa başarıyla satın alındı!', 'success');
        } else {
          const stageNames = {
            foundation: '🧱 Temel başarıyla atıldı!',
            walls: '🏗️ Duvarlar başarıyla yapıldı!',
            roof: '🏠 Ev tamamlandı! Artık dekore edebilirsiniz!'
          };
          addToast(stageNames[stage] || 'İnşaat aşaması tamamlandı!', 'success');
        }
      }
    } catch (error) {
      console.error('Building action error:', error);
      addToast('Beklenmeyen bir hata oluştu.', 'error');
    }
  };

  // Drag & drop devre dışı: dekor öğeleri satın alındığında otomatik yerleşir.

  const placeFromInventory = async (item) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { x, y } = getAutoPlacement(item.id, rect);
    await placeDecor(item.id, x, y, currentView);
  };
  
  const renderHouseBuilding = () => {
    const house = userStats?.house;
    // Normalize: if land is purchased and buildingStage is 'none' or empty, treat as 'land'
    const currentStage = house?.landPurchased
      ? (house.buildingStage && house.buildingStage !== 'none' ? house.buildingStage : 'land')
      : 'none';
    const stageInfo = buildingStages[currentStage];
    
    if (currentStage === 'completed') {
      return (
        <div className="house-completed">
          <div className="house-visual">🏠</div>
          <h3>Eviniz Hazır!</h3>
          <p>Artık iç ve dış dekorasyona başlayabilirsiniz.</p>
        </div>
      );
    }
    
    return (
      <div className="house-building">
        <div className="building-stage">
          <h3>{stageInfo.name}</h3>
          {stageInfo.next && (
            <div className="next-stage">
              <p>Sonraki: {buildingStages[stageInfo.next]?.name}</p>
              <p>Maliyet: {stageInfo.cost} XP (Mevcut: {userStats?.xp || 0} XP)</p>
              <button 
                className="btn btn--primary"
                onClick={() => handleBuildingAction(stageInfo.action, stageInfo.next)}
                disabled={userStats.xp < stageInfo.cost}
              >
                {currentStage === 'none' ? 'Arsa Satın Al' : 'İnşa Et'}
              </button>
              {userStats.xp < stageInfo.cost && (
                <p style={{color: 'red', fontSize: '0.9rem', marginTop: '8px'}}>
                  {stageInfo.cost - userStats.xp} XP daha gerekli
                </p>
              )}
            </div>
          )}
          {userStats?.house?.landPurchased && currentStage !== 'completed' && (
            <div className="build-actions">
              {(() => {
                const costs = { foundation: 300, walls: 400, roof: 350 };
                const nextExpected = currentStage === 'land'
                  ? 'foundation'
                  : currentStage === 'foundation'
                    ? 'walls'
                    : currentStage === 'walls'
                      ? 'roof'
                      : null;
                const canDo = (stage) => nextExpected === stage && (userStats?.xp || 0) >= costs[stage];
                const lackXp = (stage) => (userStats?.xp || 0) < costs[stage];
                return (
                  <>
                    <button
                      className={`btn ${nextExpected === 'foundation' ? 'btn--primary' : ''}`}
                      onClick={() => handleBuildingAction('buildStage', 'foundation')}
                      disabled={!canDo('foundation')}
                      title={lackXp('foundation') ? `Gerekli: ${costs.foundation} XP` : 'Temel at'}
                    >
                      🧱 Temel ({costs.foundation} XP)
                    </button>
                    <button
                      className={`btn ${nextExpected === 'walls' ? 'btn--primary' : ''}`}
                      onClick={() => handleBuildingAction('buildStage', 'walls')}
                      disabled={!canDo('walls')}
                      title={lackXp('walls') ? `Gerekli: ${costs.walls} XP` : 'Duvarları yap'}
                    >
                      🏗️ Duvarlar ({costs.walls} XP)
                    </button>
                    <button
                      className={`btn ${nextExpected === 'roof' ? 'btn--primary' : ''}`}
                      onClick={() => handleBuildingAction('buildStage', 'roof')}
                      disabled={!canDo('roof')}
                      title={lackXp('roof') ? `Gerekli: ${costs.roof} XP` : 'Çatıyı yap'}
                    >
                      🏠 Çatı ({costs.roof} XP)
                    </button>
                    {nextExpected && lackXp(nextExpected) && (
                      <p className="hint-xp">{costs[nextExpected] - (userStats?.xp || 0)} XP daha gerekli</p>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
        <div className="building-visual">
          <div className={`house-construction house-construction--${currentStage}`}>
            {currentStage === 'none' && (
              <div className="empty-land">
                <div className="grass"></div>
                <div className="trees">
                  <div className="tree"></div>
                  <div className="tree"></div>
                </div>
              </div>
            )}
            {currentStage === 'land' && (
              <div className="purchased-land">
                <div className="ground"></div>
                <div className="survey-markers">
                  <div className="marker"></div>
                  <div className="marker"></div>
                  <div className="marker"></div>
                  <div className="marker"></div>
                </div>
              </div>
            )}
            {currentStage === 'foundation' && (
              <div className="foundation-stage">
                <div className="ground"></div>
                <div className="foundation"></div>
                <div className="rebar"></div>
              </div>
            )}
            {currentStage === 'walls' && (
              <div className="walls-stage">
                <div className="ground"></div>
                <div className="foundation"></div>
                <div className="wall wall--front"></div>
                <div className="wall wall--left"></div>
                <div className="wall wall--right"></div>
                <div className="wall wall--back"></div>
                <div className="door-frame"></div>
                <div className="window-frame window-frame--left"></div>
                <div className="window-frame window-frame--right"></div>
              </div>
            )}
            {currentStage === 'roof' && (
              <div className="roof-stage">
                <div className="ground"></div>
                <div className="foundation"></div>
                <div className="wall wall--front"></div>
                <div className="wall wall--left"></div>
                <div className="wall wall--right"></div>
                <div className="wall wall--back"></div>
                <div className="door-frame"></div>
                <div className="window-frame window-frame--left"></div>
                <div className="window-frame window-frame--right"></div>
                <div className="roof roof--front"></div>
                <div className="roof roof--left"></div>
                <div className="roof roof--right"></div>
                <div className="chimney"></div>
                <div className="roof-tiles"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const house = userStats?.house;
  const isHouseCompleted = house?.buildingStage === 'completed';

  return (
    <div className="decor-studio">
      <header className="decor-studio__header">
        <button className="icon-btn" onClick={goBack} aria-label="Geri dön">
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1>Ev Yapımı & Dekorasyon</h1>
        <div className="decor-studio__xp">XP: {userStats?.xp || 0}</div>
      </header>
      
      {isHouseCompleted && (
        <div className="view-toggle">
          <button 
            className={`btn ${currentView === 'exterior' ? 'btn--primary' : ''}`}
            onClick={() => setCurrentView('exterior')}
          >
            🏡 Dış Mekan
          </button>
          <button 
            className={`btn ${currentView === 'interior' ? 'btn--primary' : ''}`}
            onClick={() => setCurrentView('interior')}
          >
            🏠 İç Mekan
          </button>
        </div>
      )}

      <section className="decor-studio__section">
        {!isHouseCompleted ? (
          renderHouseBuilding()
        ) : (
          <>
            <div className="decor-toolbar">
              <div className="toolbar-left">
                <h2>{currentView === 'exterior' ? '🏡 Dış Mekan' : '🏠 İç Mekan'}</h2>
                <button className={`icon-btn ${showGrid ? 'is-active' : ''}`} onClick={() => setShowGrid(v => !v)} title="Izgarayı Aç/Kapat" aria-label="Izgarayı Aç/Kapat">
                  <i className="fas fa-border-all"></i>
                </button>
              </div>
              <div className="toolbar-right">
                <button className="icon-btn" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(2)))} title="Uzaklaştır" aria-label="Uzaklaştır">-
                </button>
                <div className="zoom-indicator">{Math.round(zoom * 100)}%</div>
                <button className="icon-btn" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))} title="Yakınlaştır" aria-label="Yakınlaştır">+
                </button>
                <button className="icon-btn" onClick={() => setZoom(1)} title="Sıfırla" aria-label="Yakınlaştırmayı sıfırla">
                  <i className="fas fa-undo"></i>
                </button>
              </div>
            </div>
            <div
              ref={canvasRef}
              className={`decor-canvas ${showGrid ? 'decor-canvas--grid' : ''} decor-canvas--${currentView}`}
            >
              {placed.length === 0 && (
                <div className="decor-canvas__empty">
                  {currentView === 'exterior' ? 'Bahçe boş. Dış dekorasyon ekleyin.' : 'Ev boş. İç dekorasyon ekleyin.'}
                </div>
              )}
              <div className="decor-canvas__inner" style={{ transform: `scale(${zoom})` }}>
                {isHouseCompleted && (
                  <div className={`canvas-backdrop canvas-backdrop--${currentView}`} aria-hidden>
                    {currentView === 'exterior' ? (
                      <img src={exteriorBg} alt="Dış mekan arkaplanı" className="canvas-backdrop__img" />
                    ) : (
                      <img src={interiorBg} alt="İç mekan arkaplanı" className="canvas-backdrop__img" />
                    )}
                  </div>
                )}
                {placed.map((p) => {
                  const meta = getItemMeta(p.id);
                  const x = p.x || 0;
                  const y = p.y || 0;
                  const scale = p.scale || 1;
                  // Fence keeps special container across exterior
                  if (p.id === 'fence') {
                    return (
                      <div key={p.id} className="decor-fence" data-decor-id={p.id}>
                        <img src={fenceImg} alt="Çit" className="decor-fence__img" />
                      </div>
                    );
                  }
                  // Generic: if we have an image for this item, render it as an image-based node
                  const imgSrc = getItemImage(p.id);
                  if (imgSrc) {
                    return (
                      <div
                        key={p.id}
                        data-decor-id={p.id}
                        className="decor-node"
                        style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
                      >
                        <img src={imgSrc} alt={meta.name || p.id} className="decor-img" />
                      </div>
                    );
                  }
                  // Fallback generic icon for other/indoor items
                  return (
                    <div
                      key={p.id}
                      data-decor-id={p.id}
                      className="decor-node"
                      style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}
                    >
                      <div className="decor-node__icon">{meta.icon || '🖼️'}</div>
                      <div className="decor-node__size" onPointerDown={(e) => e.stopPropagation()}>
                        <button className="decor-node__btn" aria-label="Küçült" onClick={async () => {
                          const next = Math.max(0.5, (scale - 0.1));
                          await updateDecorScale(p.id, +next.toFixed(2), currentView);
                        }}>-</button>
                        <button className="decor-node__btn" aria-label="Büyüt" onClick={async () => {
                          const next = Math.min(2, (scale + 0.1));
                          await updateDecorScale(p.id, +next.toFixed(2), currentView);
                        }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      {isHouseCompleted && (
        <section className="decor-studio__section">
          <h2>Envanter - {currentView === 'exterior' ? 'Dış Mekan' : 'İç Mekan'}</h2>
          <div className="decor-grid">
            {inventory.length === 0 && <div className="empty">Envanter boş.</div>}
            {inventory.map((item, idx) => (
              <div key={idx} className="decor-card">
                <div className="decor-card__thumb">
                  {getItemImage(item.id) ? (
                    <img src={getItemImage(item.id)} alt={item.name || item.id} className="decor-card__img" />
                  ) : (
                    <span>{item.icon || '🖼️'}</span>
                  )}
                </div>
                <div className="decor-card__meta">
                  <div className="decor-card__title">{item.name || item.id}</div>
                  <div className="decor-card__desc">{isPlaced(item.id) ? 'Sahnede yerleştirildi' : 'Sahneye yerleştirilebilir'}</div>
                </div>
                <div className="decor-card__actions">
                  {isPlaced(item.id) ? (
                    <button
                      className="btn"
                      onClick={async () => { await removeDecor(item.id, currentView); }}
                    >Çıkart</button>
                  ) : (
                    <button
                      className="btn btn--primary"
                      onClick={async () => { await placeFromInventory(item); }}
                    >Yerleştir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isHouseCompleted && shopItems.length > 0 && (
        <section className="decor-studio__section">
          <h2>Mağaza - {currentView === 'exterior' ? 'Dış Mekan' : 'İç Mekan'}</h2>
          <div className="shop-toolbar">
            <div className="shop-filters">
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara..." />
            </div>
          </div>
          <div className="decor-grid">
            {shopItems
              .filter(i => category === 'all' || i.category === category)
              .filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
              .map((shopItem) => (
                <div key={shopItem.id} className="decor-card">
                  <div className="decor-card__thumb">
                    {getItemImage(shopItem.id) ? (
                      <img src={getItemImage(shopItem.id)} alt={shopItem.name} className="decor-card__img" />
                    ) : (
                      <span>{shopItem.icon}</span>
                    )}
                  </div>
                  <div className="decor-card__meta">
                    <div className="decor-card__title">{shopItem.name}</div>
                    <div className="decor-card__desc">Fiyat: {shopItem.price} XP · Boyut: {shopItem.size}</div>
                  </div>
                  <div className="decor-card__actions">
                    {isPlaced(shopItem.id) ? (
                      <span className="badge badge--success">Yerleştirildi</span>
                    ) : isInInventory(shopItem.id) ? (
                      <span className="badge">Sahipsiniz</span>
                    ) : (
                      <button
                        className="btn"
                        onClick={async () => {
                          const res = await spendXP(shopItem.price);
                          if (res?.ok) {
                            await addDecorToInventory(shopItem, currentView);
                            const canvas = canvasRef.current;
                            if (canvas) {
                              const rect = canvas.getBoundingClientRect();
                              const { x, y } = getAutoPlacement(shopItem.id, rect);
                              await placeDecor(shopItem.id, x, y, currentView);
                            }
                            addToast('Eklendi ve sahneye yerleştirildi.', 'success');
                          }
                        }}
                      >Satın Al</button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
      <ToastContainer />
    </div>
  );
}
