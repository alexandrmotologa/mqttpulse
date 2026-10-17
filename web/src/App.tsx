import { useState } from 'react';
import { useMqttStream } from './hooks/useMqttStream';
import { Header, MainViewType } from './components/Header';
import { TopicTreeRadial } from './components/TopicTreeRadial';
import { TopicTreeIndented } from './components/TopicTreeIndented';
import { MessageStreamTable } from './components/MessageStreamTable';
import { PacketInspector } from './components/PacketInspector';
import { FleetControls } from './components/FleetControls';
import { PublishTestBench } from './components/PublishTestBench';
import { LivePlotter } from './components/LivePlotter';
import { FleetMapView } from './components/FleetMapView';
import { RpcConsole } from './components/RpcConsole';
import { RulesAlertsModal } from './components/RulesAlertsModal';
import { ConnectModal } from './components/ConnectModal';
import { InboundMessage } from './types';

export function App() {
  const {
    status,
    brokerUrl,
    stats,
    treeData,
    messages,
    fleetStats,
    fleetConfig,
    embeddedRunning,
    selectedNodeTopic,
    setSelectedNodeTopic,
    selectedMessage,
    setSelectedMessage,
    alerts,
    rules,
    geoMarkers,
    isRecording,
    recordingCount,
    isMuted,
    rpcHistory,
    toggleMute,
    connectBroker,
    disconnectBroker,
    publishMessage,
    sendRpc,
    clearTree,
    startSimulator,
    stopSimulator,
    resetSimulator,
    updateSimulatorConfig,
    toggleEmbeddedBroker,
    startRecording,
    stopRecording,
    addRule,
    deleteRule,
    toggleRule,
    clearAlerts,
    markAlertsRead
  } = useMqttStream();

  const [activeView, setActiveView] = useState<MainViewType>('radial');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const handleSelectMessage = (msg: InboundMessage) => {
    setSelectedMessage(msg);
  };

  const handleCloseInspector = () => {
    setSelectedMessage(null);
  };

  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Header Bar */}
      <Header
        status={status}
        brokerUrl={brokerUrl}
        stats={stats}
        embeddedRunning={embeddedRunning}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onDisconnect={disconnectBroker}
        onToggleEmbedded={toggleEmbeddedBroker}
        onClear={clearTree}
        simulatorRunning={fleetStats?.running ?? false}
        unreadAlertsCount={unreadAlertsCount}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        isRecording={isRecording}
        recordingCount={recordingCount}
        onToggleRecording={() => (isRecording ? stopRecording() : startRecording())}
        isMuted={isMuted}
        onToggleMute={toggleMute}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-3 gap-3">
        {/* Left / Primary Interactive View */}
        <div className="w-full md:w-7/12 h-1/2 md:h-full flex flex-col min-w-0">
          {activeView === 'radial' && (
            <TopicTreeRadial
              data={treeData}
              onSelectTopic={(topic) => setSelectedNodeTopic(topic)}
              selectedTopic={selectedNodeTopic}
            />
          )}

          {activeView === 'indented' && (
            <TopicTreeIndented
              data={treeData}
              onSelectTopic={(topic) => setSelectedNodeTopic(topic)}
              selectedTopic={selectedNodeTopic}
            />
          )}

          {activeView === 'plotter' && (
            <LivePlotter initialTopic={selectedNodeTopic} />
          )}

          {activeView === 'map' && (
            <FleetMapView
              markers={geoMarkers}
              onSelectTopic={(topic) => setSelectedNodeTopic(topic)}
            />
          )}

          {activeView === 'rpc' && (
            <RpcConsole
              onSendRpc={sendRpc}
              history={rpcHistory}
            />
          )}

          {activeView === 'simulator' && (
            <FleetControls
              stats={fleetStats}
              config={fleetConfig}
              onStart={startSimulator}
              onStop={stopSimulator}
              onReset={resetSimulator}
              onUpdateConfig={updateSimulatorConfig}
            />
          )}

          {activeView === 'publisher' && (
            <PublishTestBench
              onPublish={publishMessage}
              defaultTopic={selectedNodeTopic || undefined}
            />
          )}
        </div>

        {/* Right / Split Message Stream & Deep Packet Inspector */}
        <div className="w-full md:w-5/12 h-1/2 md:h-full flex flex-col relative min-w-0">
          <MessageStreamTable
            messages={messages}
            onSelectMessage={handleSelectMessage}
            selectedMessageId={selectedMessage?.id ?? null}
            onClear={() => {}}
          />

          {/* Slide-over Packet Inspector Drawer */}
          {selectedMessage && (
            <div className="absolute inset-0 z-20 rounded-xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right duration-200">
              <PacketInspector message={selectedMessage} onClose={handleCloseInspector} />
            </div>
          )}
        </div>
      </div>

      {/* Broker Connection Modal */}
      <ConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onConnect={async (params) => {
          await connectBroker(params);
        }}
        currentUrl={brokerUrl}
      />

      {/* Rules & Telemetry Alerts Modal */}
      <RulesAlertsModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        rules={rules}
        alerts={alerts}
        onAddRule={addRule}
        onDeleteRule={deleteRule}
        onToggleRule={toggleRule}
        onClearAlerts={clearAlerts}
        onMarkRead={markAlertsRead}
      />
    </div>
  );
}

export default App;
