"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { STORAGE_KEY, defaultItems } from "../lib/default-items";

function cloneDefaultItems() {
  return JSON.parse(JSON.stringify(defaultItems));
}

function loadStoredItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultItems();
    }

    const parsed = JSON.parse(raw);
    const mergedDefaults = cloneDefaultItems();
    const result = { ...mergedDefaults };

    Object.entries(parsed).forEach(([key, value]) => {
      result[key] = { ...(mergedDefaults[key] || {}), ...value };
    });

    return result;
  } catch (_error) {
    return cloneDefaultItems();
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDeviceName(device) {
  return device && device.name ? device.name : "未命名设备";
}

function buildBleRequestOptions(item) {
  if (item && item.deviceName) {
    return { filters: [{ namePrefix: item.deviceName }] };
  }
  return { acceptAllDevices: true };
}

function parseRoute(pathname) {
  const cleaned = (pathname || "/").replace(/^\/+|\/+$/g, "");

  if (!cleaned) {
    return { name: "home" };
  }

  const parts = cleaned.split("/");

  if (parts[0] === "find") {
    return { name: "find" };
  }

  if (parts[0] === "manage" && !parts[1]) {
    return { name: "manage" };
  }

  if (parts[0] === "manage" && parts[1] === "new") {
    return { name: "manage-new" };
  }

  if (parts[0] === "manage" && parts[1]) {
    return { name: "manage-edit", itemId: parts[1] };
  }

  if (parts[0] === "item" && parts[1] && parts[2] === "details") {
    return { name: "details", itemId: parts[1] };
  }

  if (parts[0] === "item" && parts[1]) {
    return { name: "item", itemId: parts[1] };
  }

  return { name: "not-found" };
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取音频文件失败。"));
    reader.readAsDataURL(file);
  });
}

function getSectionPayload(item, section) {
  const map = {
    intro: {
      text: item.intro,
      audio: item.introAudio,
      announce: `${item.name} 简介播报`,
    },
    usage: {
      text: item.usage,
      audio: item.usageAudio,
      announce: `${item.name} 用途`,
    },
    cautions: {
      text: item.cautions,
      audio: item.cautionsAudio,
      announce: `${item.name} 注意事项`,
    },
    notes: {
      text: item.notes,
      audio: item.notesAudio,
      announce: `${item.name} 特殊备注`,
    },
  };

  return map[section];
}

function getBleSupportText() {
  return "bluetooth" in navigator
    ? "当前浏览器支持 Web Bluetooth，可以尝试真实连接 BLE 设备。"
    : "当前浏览器不支持 Web Bluetooth，这一页只能先展示连接流程。建议后续在支持的安卓浏览器中测试。";
}

function getNfcSupportText() {
  if (!window.isSecureContext) {
    return "当前不是安全环境，浏览器通常不允许网页直接写入 NFC。";
  }
  return "NDEFReader" in window
    ? "当前浏览器支持 Web NFC，可以尝试写入标签。"
    : "当前浏览器不支持 Web NFC，建议后续在支持的安卓浏览器中测试。";
}

function HomePage({ pairedCount, allCount, onFind, onManage }) {
  return (
    <div className="hero stack">
      <span className="pill">首页</span>
      <h2>请选择操作</h2>
      <p className="supporting-text">
        这是基于 Node 框架的网页版本。主页分成两个大入口：寻找物品，以及管理物品。
      </p>
      <div className="stats-grid">
        <div className="info-card">
          <span className="label">已连接设备</span>
          <p className="field-value">{pairedCount}</p>
        </div>
        <div className="info-card">
          <span className="label">物品总数</span>
          <p className="field-value">{allCount}</p>
        </div>
      </div>
      <div className="action-grid">
        <button className="big-button" type="button" onClick={onFind}>
          寻找物品
        </button>
        <button className="big-button secondary-hero-button" type="button" onClick={onManage}>
          管理物品
        </button>
      </div>
      <p className="small-note">如果用户已经碰到了 NFC 标签，就不需要经过首页，而是应直接进入对应物品页面。</p>
    </div>
  );
}

function NotFoundPage({ onBackHome }) {
  return (
    <div className="stack not-found">
      <span className="pill">页面不存在</span>
      <h2>没有找到这个物品页面</h2>
      <p className="supporting-text">请检查 NFC 标签写入的网址是否正确，或者返回首页。</p>
      <button className="big-button" type="button" onClick={onBackHome}>
        返回首页
      </button>
    </div>
  );
}

function ManagePage({ items, nfcSupportText, onAddItem, onBackHome, onOpenItem }) {
  return (
    <div className="stack">
      <span className="pill">管理物品</span>
      <h2>物品和设备管理</h2>
      <p className="supporting-text">这里可以查看之前连过的设备，并维护盲人真正会用到的物品内容。</p>

      <div className="button-row two">
        <button className="big-button" type="button" onClick={onAddItem}>
          添加新物品
        </button>
        <button className="ghost-button" type="button" onClick={onBackHome}>
          返回首页
        </button>
      </div>

      <div className="detail-card">
        <h3>NFC 能力</h3>
        <p>{nfcSupportText}</p>
      </div>

      <div className="device-list">
        {items.map((item) => (
          <div className="device-card" key={item.id}>
            <div className="card-topline">
              <h3>{item.name}</h3>
              <span className={`badge ${item.paired ? "badge-active" : "badge-muted"}`}>
                {item.paired ? "已连接" : "未连接"}
              </span>
            </div>
            <p className="small-note">蓝牙名称：{item.lastKnownBleName || item.deviceName || "未设置"}</p>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => onOpenItem(item.id)}>
                查看并编辑物品
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FindPage({
  pairedItems,
  bleSupportedText,
  statusText,
  selectedItemId,
  onConnectAndFind,
  onScanAny,
  onDisconnect,
  onManage,
  onBackHome,
}) {
  return (
    <div className="stack">
      <span className="pill">寻找物品</span>
      <h2>已连接过的设备</h2>
      <p className="supporting-text">{bleSupportedText}</p>

      <p className="status" role="status">
        {statusText}
      </p>

      <div className="device-list">
        {pairedItems.length ? (
          pairedItems.map((item) => (
            <div className={`device-card ${selectedItemId === item.id ? "selected-card" : ""}`} key={item.id}>
              <h3>{item.name}</h3>
              <p>位置备注：{item.ownerHint}</p>
              <p className="small-note">蓝牙名称：{item.lastKnownBleName || item.deviceName || "未设置"}</p>
              <p className="small-note">
                {item.ringServiceUuid && item.ringCharacteristicUuid
                  ? "已设置响铃参数"
                  : "尚未设置响铃参数，请先由开发版数据或后端配置补充"}
              </p>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => onConnectAndFind(item.id)}>
                  连接并寻找
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="detail-card">
            <h3>还没有已连接设备</h3>
            <p>请先到“管理物品”里新增物品，或后续通过云端数据同步设备信息。</p>
          </div>
        )}
      </div>

      <div className="detail-card stack">
        <h3>蓝牙操作</h3>
        <p className="small-note">
          如果你的硬件广播名已经固定，可以直接点击“连接并寻找”。如果名字还没固定，也可以扫描任意 BLE 设备。
        </p>
        <div className="button-row two">
          <button className="secondary-button" type="button" onClick={onScanAny}>
            扫描任意 BLE 设备
          </button>
          <button className="ghost-button" type="button" onClick={onDisconnect}>
            断开当前连接
          </button>
        </div>
      </div>

      <div className="button-row">
        <button className="ghost-button" type="button" onClick={onManage}>
          去管理物品
        </button>
        <button className="ghost-button" type="button" onClick={onBackHome}>
          返回首页
        </button>
      </div>
    </div>
  );
}

function ItemPage({ item, onOpenDetails, onExit, onReplayIntro, itemStatus }) {
  return (
    <div className="stack">
      <span className="pill">NFC 物品页</span>
      <h2>{item.name}</h2>
      <p className="supporting-text">页面打开后会优先播报物品名称，帮助用户立即确认身份。</p>

      <div className="info-list">
        <div className="info-card">
          <span className="label">物品类型</span>
          <p className="field-value">{item.type}</p>
        </div>
        <div className="info-card">
          <span className="label">位置备注</span>
          <p className="field-value">{item.ownerHint}</p>
        </div>
      </div>

      <p className="status" role="status">
        {itemStatus}
      </p>

      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onReplayIntro}>
          重新播放物品名称
        </button>
        <button className="ghost-button" type="button" onClick={onOpenDetails}>
          展开详细信息
        </button>
        <button className="ghost-button" type="button" onClick={onExit}>
          退出
        </button>
      </div>
    </div>
  );
}

function DetailsPage({ item, onSpeakSection, onBackItem, onExitHome }) {
  return (
    <div className="stack">
      <span className="pill">详细信息</span>
      <h2>{item.name}</h2>
      <p className="supporting-text">详细内容拆成三个独立部分，避免一次性播放过多信息。</p>

      <div className="detail-list">
        <div className="detail-card">
          <h3>用途</h3>
          <p>{item.usage}</p>
          <button className="secondary-button" type="button" onClick={() => onSpeakSection("usage")}>
            播放用途
          </button>
        </div>

        <div className="detail-card">
          <h3>注意事项</h3>
          <p>{item.cautions}</p>
          <button className="secondary-button" type="button" onClick={() => onSpeakSection("cautions")}>
            播放注意事项
          </button>
        </div>

        <div className="detail-card">
          <h3>特殊备注</h3>
          <p>{item.notes}</p>
          <button className="secondary-button" type="button" onClick={() => onSpeakSection("notes")}>
            播放特殊备注
          </button>
        </div>
      </div>

      <div className="button-row two">
        <button className="ghost-button" type="button" onClick={onBackItem}>
          返回物品页
        </button>
        <button className="ghost-button" type="button" onClick={onExitHome}>
          退出
        </button>
      </div>
    </div>
  );
}

function ManageEditorPage({ item, isNew, onSave, onBack }) {
  const [formState, setFormState] = useState({
    name: item.name || "",
    intro: item.intro || "",
    usage: item.usage || "",
    cautions: item.cautions || "",
    notes: item.notes || "",
  });
  const [files, setFiles] = useState({
    introAudioFile: null,
    usageAudioFile: null,
    cautionsAudioFile: null,
    notesAudioFile: null,
  });
  const [statusText, setStatusText] = useState(isNew ? "请填写物品信息后保存。" : "可以修改当前物品的信息。");

  useEffect(() => {
    setFormState({
      name: item.name || "",
      intro: item.intro || "",
      usage: item.usage || "",
      cautions: item.cautions || "",
      notes: item.notes || "",
    });
    setFiles({
      introAudioFile: null,
      usageAudioFile: null,
      cautionsAudioFile: null,
      notesAudioFile: null,
    });
    setStatusText(isNew ? "请填写物品信息后保存。" : "可以修改当前物品的信息。");
  }, [item, isNew]);

  const handleFileChange = (key, file) => {
    setFiles((prev) => ({ ...prev, [key]: file || null }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const message = await onSave({ formState, files, item, isNew });
      if (message) {
        setStatusText(message);
      }
    } catch (error) {
      setStatusText(error.message);
    }
  };

  return (
    <div className="stack">
      <span className="pill">{isNew ? "添加物品" : "编辑物品"}</span>
      <h2>{isNew ? "添加新物品" : item.name}</h2>
      <p className="supporting-text">这里只保留盲人使用时真正需要维护的内容，并支持为每一项添加音频。</p>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="stack">
          <label className="form-field">
            <span className="label">名称</span>
            <input
              className="text-input"
              name="name"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>

          <div className="detail-card stack">
            <label className="form-field">
              <span className="label">简介播报文字</span>
              <textarea
                className="text-area"
                name="intro"
                value={formState.intro}
                onChange={(event) => setFormState((prev) => ({ ...prev, intro: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="label">简介播报音频</span>
              <input
                className="file-input"
                type="file"
                accept="audio/*"
                onChange={(event) => handleFileChange("introAudioFile", event.target.files?.[0])}
              />
            </label>
            <p className="small-note">{item.introAudio ? "已保存音频" : "当前只使用文字"}</p>
          </div>

          <div className="detail-card stack">
            <label className="form-field">
              <span className="label">用途文字</span>
              <textarea
                className="text-area"
                name="usage"
                value={formState.usage}
                onChange={(event) => setFormState((prev) => ({ ...prev, usage: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="label">用途音频</span>
              <input
                className="file-input"
                type="file"
                accept="audio/*"
                onChange={(event) => handleFileChange("usageAudioFile", event.target.files?.[0])}
              />
            </label>
            <p className="small-note">{item.usageAudio ? "已保存音频" : "当前只使用文字"}</p>
          </div>

          <div className="detail-card stack">
            <label className="form-field">
              <span className="label">注意事项文字</span>
              <textarea
                className="text-area"
                name="cautions"
                value={formState.cautions}
                onChange={(event) => setFormState((prev) => ({ ...prev, cautions: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="label">注意事项音频</span>
              <input
                className="file-input"
                type="file"
                accept="audio/*"
                onChange={(event) => handleFileChange("cautionsAudioFile", event.target.files?.[0])}
              />
            </label>
            <p className="small-note">{item.cautionsAudio ? "已保存音频" : "当前只使用文字"}</p>
          </div>

          <div className="detail-card stack">
            <label className="form-field">
              <span className="label">特殊备注文字</span>
              <textarea
                className="text-area"
                name="notes"
                value={formState.notes}
                onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="label">特殊备注音频</span>
              <input
                className="file-input"
                type="file"
                accept="audio/*"
                onChange={(event) => handleFileChange("notesAudioFile", event.target.files?.[0])}
              />
            </label>
            <p className="small-note">{item.notesAudio ? "已保存音频" : "当前只使用文字"}</p>
          </div>
        </div>

        <div className="button-row two">
          <button className="big-button" type="submit">
            保存物品
          </button>
          <button className="ghost-button" type="button" onClick={onBack}>
            返回上一页
          </button>
        </div>

        <p className="status" role="status">
          {statusText}
        </p>
      </form>
    </div>
  );
}

export default function GoldenCaneApp() {
  const router = useRouter();
  const pathname = usePathname();
  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const mainRef = useRef(null);
  const liveRegionRef = useRef(null);
  const activeAudioRef = useRef(null);
  const itemsRef = useRef(cloneDefaultItems());
  const bleStateRef = useRef({
    device: null,
    server: null,
    connectedItemId: "",
    selectedItemId: "cold-medicine",
    ringServiceUuid: "",
    ringCharacteristicUuid: "",
    ringHex: "01",
  });
  const [items, setItems] = useState(cloneDefaultItems());
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [findStatus, setFindStatus] = useState("当前尚未连接设备。请选择一个已经连过的物品。");
  const [itemStatus, setItemStatus] = useState("正在尝试播报物品名称。");
  const [bleState, setBleState] = useState(bleStateRef.current);

  const announce = useCallback((text) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = text;
    }
  }, []);

  const speak = useCallback(
    (text, announceOnly = false) => {
      announce(text);

      if (announceOnly || !("speechSynthesis" in window)) {
        return false;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      return true;
    },
    [announce],
  );

  const stopSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    stopSpeech();
    stopAudioPlayback();
  }, [stopAudioPlayback, stopSpeech]);

  const playTextOrAudio = useCallback(
    async (text, audioSrc, announceText) => {
      if (announceText) {
        announce(announceText);
      }

      stopPlayback();

      if (audioSrc) {
        try {
          const audio = new Audio(audioSrc);
          activeAudioRef.current = audio;
          await audio.play();
          return "audio";
        } catch (_error) {
          activeAudioRef.current = null;
        }
      }

      const ok = speak(text);
      return ok ? "speech" : "none";
    },
    [announce, speak, stopPlayback],
  );

  const updateItem = useCallback((itemId, patch) => {
    setItems((prev) => {
      const existing = prev[itemId];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [itemId]: { ...existing, ...patch },
      };
    });
  }, []);

  const createItem = useCallback((data) => {
    setItems((prev) => ({
      ...prev,
      [data.id]: data,
    }));
  }, []);

  const updateBleConfigFromItem = useCallback((itemId) => {
    const item = itemsRef.current[itemId];
    setBleState((prev) => ({
      ...prev,
      selectedItemId: itemId,
      ringServiceUuid: item?.ringServiceUuid || "",
      ringCharacteristicUuid: item?.ringCharacteristicUuid || "",
      ringHex: item?.ringHex || "01",
    }));
  }, []);

  const handleBleDisconnected = useCallback(() => {
    const currentDevice = bleStateRef.current.device;
    const name = formatDeviceName(currentDevice);
    setBleState((prev) => ({
      ...prev,
      device: null,
      server: null,
      connectedItemId: "",
    }));
    speak(`${name} 已断开连接。`, true);
    setFindStatus(`${name} 已断开连接。`);
  }, [speak]);

  const connectBleDevice = useCallback(
    async (options) => {
      if (!("bluetooth" in navigator)) {
        throw new Error("当前浏览器不支持 Web Bluetooth。");
      }

      const currentBleState = bleStateRef.current;
      const requestOptions = { ...(options || { acceptAllDevices: true }) };
      if (currentBleState.ringServiceUuid) {
        requestOptions.optionalServices = [currentBleState.ringServiceUuid];
      }

      const device = await navigator.bluetooth.requestDevice(requestOptions);
      device.removeEventListener("gattserverdisconnected", handleBleDisconnected);
      device.addEventListener("gattserverdisconnected", handleBleDisconnected);

      const server = await device.gatt.connect();
      setBleState((prev) => ({
        ...prev,
        device,
        server,
      }));

      const selectedItem = itemsRef.current[currentBleState.selectedItemId];
      if (selectedItem) {
        updateItem(selectedItem.id, {
          paired: true,
          lastKnownBleName: formatDeviceName(device),
        });
      }

      return device;
    },
    [handleBleDisconnected, updateItem],
  );

  const disconnectBleDevice = useCallback(async () => {
    const current = bleStateRef.current;
    if (current.device?.gatt?.connected) {
      current.device.gatt.disconnect();
    } else {
      setBleState((prev) => ({
        ...prev,
        device: null,
        server: null,
        connectedItemId: "",
      }));
    }
  }, []);

  const sendRingCommand = useCallback(async () => {
    const current = bleStateRef.current;
    if (!current.server) {
      throw new Error("请先连接蓝牙设备。");
    }

    if (!current.ringServiceUuid || !current.ringCharacteristicUuid) {
      throw new Error("请先配置设备的服务 UUID 和特征 UUID。");
    }

    const service = await current.server.getPrimaryService(current.ringServiceUuid);
    const characteristic = await service.getCharacteristic(current.ringCharacteristicUuid);
    await characteristic.writeValue(new Uint8Array([1]));
  }, []);

  const saveManagedItem = useCallback(
    async ({ formState, files, item, isNew }) => {
      const name = String(formState.name || "").trim();
      if (!name) {
        throw new Error("请先填写物品名称。");
      }

      const nextId = isNew ? slugify(name || `item-${Date.now()}`) : item.id;
      const nextItem = {
        ...(isNew ? {} : item),
        id: nextId,
        name,
        intro: String(formState.intro || "").trim() || `这是${name}。`,
        introAudio: files.introAudioFile ? await readFileAsDataUrl(files.introAudioFile) : item.introAudio || "",
        usage: String(formState.usage || "").trim(),
        usageAudio: files.usageAudioFile ? await readFileAsDataUrl(files.usageAudioFile) : item.usageAudio || "",
        cautions: String(formState.cautions || "").trim(),
        cautionsAudio: files.cautionsAudioFile
          ? await readFileAsDataUrl(files.cautionsAudioFile)
          : item.cautionsAudio || "",
        notes: String(formState.notes || "").trim(),
        notesAudio: files.notesAudioFile ? await readFileAsDataUrl(files.notesAudioFile) : item.notesAudio || "",
        type: item.type || "物品",
        ownerHint: item.ownerHint || "",
        deviceName: item.deviceName || "",
        ringServiceUuid: item.ringServiceUuid || "",
        ringCharacteristicUuid: item.ringCharacteristicUuid || "",
        ringHex: item.ringHex || "01",
        paired: isNew ? false : item.paired,
        nfcTitle: item.nfcTitle || name,
        nfcPath: item.nfcPath || `/item/${nextId}`,
        lastKnownBleName: isNew ? "" : item.lastKnownBleName || "",
      };

      if (isNew) {
        createItem(nextItem);
        speak(`已新增 ${nextItem.name}。`, true);
        router.push(`/manage/${nextItem.id}`);
        return `已新增 ${nextItem.name}。`;
      }

      updateItem(item.id, nextItem);
      speak(`已保存 ${nextItem.name}。`, true);
      return `已保存 ${nextItem.name}。`;
    },
    [createItem, router, speak, updateItem],
  );

  useEffect(() => {
    setItems(loadStoredItems());
    setItemsLoaded(true);
  }, []);

  useEffect(() => {
    itemsRef.current = items;
    if (itemsLoaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, itemsLoaded]);

  useEffect(() => {
    bleStateRef.current = bleState;
  }, [bleState]);

  useEffect(() => {
    mainRef.current?.focus();
  }, [pathname]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const itemsArray = useMemo(() => Object.values(items), [items]);
  const pairedItems = useMemo(() => itemsArray.filter((item) => item.paired), [itemsArray]);
  const currentItem =
    route.itemId && items[route.itemId]
      ? items[route.itemId]
      : {
          id: "",
          name: "",
          intro: "",
          introAudio: "",
          usage: "",
          usageAudio: "",
          cautions: "",
          cautionsAudio: "",
          notes: "",
          notesAudio: "",
          type: "物品",
          ownerHint: "",
          deviceName: "",
          ringServiceUuid: "",
          ringCharacteristicUuid: "",
          ringHex: "01",
          paired: false,
          nfcTitle: "",
          nfcPath: "",
          lastKnownBleName: "",
        };
  const selectedItem = items[bleState.selectedItemId] || pairedItems[0];
  const bleSupportedText = typeof navigator === "undefined" ? "正在检查蓝牙能力。" : getBleSupportText();
  const nfcSupportText = typeof window === "undefined" ? "正在检查 NFC 能力。" : getNfcSupportText();

  useEffect(() => {
    if (route.name !== "item" && route.name !== "details") {
      stopPlayback();
    }
  }, [route.name, stopPlayback]);

  useEffect(() => {
    if (route.name !== "item" || !currentItem.id) {
      return;
    }

    setItemStatus("正在尝试播报物品名称。");
    const timer = window.setTimeout(async () => {
      const result = await playTextOrAudio(
        currentItem.intro,
        currentItem.introAudio,
        `${currentItem.name} 简介播报`,
      );
      setItemStatus(
        result === "audio" || result === "speech"
          ? `已播报：${currentItem.name}`
          : "当前浏览器未自动播报，请点按“重新播放物品名称”。",
      );
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentItem, playTextOrAudio, route.name]);

  const handleConnectAndFind = async (itemId) => {
    const item = items[itemId];
    if (!item) {
      return;
    }

    updateBleConfigFromItem(itemId);
    if (!item.ringServiceUuid || !item.ringCharacteristicUuid) {
      const message = `请先为 ${item.name} 配置设备的服务 UUID 和特征 UUID。`;
      setFindStatus(message);
      speak(message, true);
      return;
    }

    setFindStatus(`正在连接 ${item.name} 并启动寻找。`);
    try {
      const device = await connectBleDevice(buildBleRequestOptions(item));
      setBleState((prev) => ({
        ...prev,
        connectedItemId: itemId,
      }));
      setFindStatus(`已连接 ${formatDeviceName(device)}，正在寻找 ${item.name}。`);
      await sendRingCommand();
      const message = `${item.name} 正在响铃，请根据声音寻找。`;
      setFindStatus(message);
      speak(message, true);
    } catch (error) {
      const message = `发送失败：${error.message}`;
      setFindStatus(message);
      speak(message, true);
    }
  };

  const handleScanAny = async () => {
    setFindStatus("正在扫描任意 BLE 设备。");
    try {
      const device = await connectBleDevice({ acceptAllDevices: true });
      const message = `已连接 ${formatDeviceName(device)}。`;
      setFindStatus(message);
      speak(message, true);
    } catch (error) {
      const message = `连接失败：${error.message}`;
      setFindStatus(message);
      speak(message, true);
    }
  };

  const handleDisconnect = async () => {
    await disconnectBleDevice();
    const message = "蓝牙设备已断开。";
    setFindStatus(message);
    speak(message, true);
  };

  let pageTitle = "首页";
  let content = null;

  if (route.name === "home") {
    pageTitle = "首页";
    content = (
      <HomePage
        pairedCount={pairedItems.length}
        allCount={itemsArray.length}
        onFind={() => router.push("/find")}
        onManage={() => router.push("/manage")}
      />
    );
  } else if (route.name === "find") {
    pageTitle = "寻找物品";
    content = (
      <FindPage
        pairedItems={pairedItems}
        bleSupportedText={bleSupportedText}
        statusText={
          bleState.server
            ? `当前已连接：${formatDeviceName(bleState.device)}`
            : findStatus
        }
        selectedItemId={selectedItem?.id || ""}
        onConnectAndFind={handleConnectAndFind}
        onScanAny={handleScanAny}
        onDisconnect={handleDisconnect}
        onManage={() => router.push("/manage")}
        onBackHome={() => router.push("/")}
      />
    );
  } else if (route.name === "manage") {
    pageTitle = "管理物品";
    content = (
      <ManagePage
        items={itemsArray}
        nfcSupportText={nfcSupportText}
        onAddItem={() => router.push("/manage/new")}
        onBackHome={() => router.push("/")}
        onOpenItem={(itemId) => router.push(`/manage/${itemId}`)}
      />
    );
  } else if (route.name === "manage-new") {
    pageTitle = "添加新物品";
    content = (
      <ManageEditorPage
        item={currentItem}
        isNew
        onSave={saveManagedItem}
        onBack={() => router.push("/manage")}
      />
    );
  } else if (route.name === "manage-edit" && items[route.itemId]) {
    pageTitle = `编辑${items[route.itemId].name}`;
    content = (
      <ManageEditorPage
        item={items[route.itemId]}
        isNew={false}
        onSave={saveManagedItem}
        onBack={() => router.push("/manage")}
      />
    );
  } else if (route.name === "item" && items[route.itemId]) {
    pageTitle = items[route.itemId].name;
    content = (
      <ItemPage
        item={items[route.itemId]}
        itemStatus={itemStatus}
        onReplayIntro={async () => {
          const item = items[route.itemId];
          const result = await playTextOrAudio(item.intro, item.introAudio, `${item.name} 简介播报`);
          setItemStatus(
            result === "audio" || result === "speech"
              ? `已播报：${item.name}`
              : "当前浏览器未自动播报，请点按“重新播放物品名称”。",
          );
        }}
        onOpenDetails={() => router.push(`/item/${route.itemId}/details`)}
        onExit={() => {
          stopPlayback();
          router.push("/");
        }}
      />
    );
  } else if (route.name === "details" && items[route.itemId]) {
    pageTitle = `${items[route.itemId].name}详细信息`;
    content = (
      <DetailsPage
        item={items[route.itemId]}
        onSpeakSection={async (section) => {
          const payload = getSectionPayload(items[route.itemId], section);
          if (payload) {
            await playTextOrAudio(payload.text, payload.audio, payload.announce);
          }
        }}
        onBackItem={() => router.push(`/item/${route.itemId}`)}
        onExitHome={() => {
          stopPlayback();
          router.push("/");
        }}
      />
    );
  } else {
    pageTitle = "未找到页面";
    content = <NotFoundPage onBackHome={() => router.push("/")} />;
  }

  useEffect(() => {
    document.title = `${pageTitle} - 金盲杖`;
  }, [pageTitle]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div className="app-shell">
        <header className="site-header">
          <p className="eyebrow">金盲杖网站首版</p>
          <h1 className="site-title">物品寻找与 NFC 信息</h1>
        </header>

        <main id="main-content" ref={mainRef} tabIndex={-1}>
          <section className="panel stack">{content}</section>
        </main>

        <div ref={liveRegionRef} className="sr-only" aria-live="polite" aria-atomic="true" />
      </div>
    </>
  );
}
