import { useState } from 'react';
import { useMqttStream } from './hooks/useMqttStream';
import { Header } from './components/Header';
import { TopicTreeRadial } from './components/TopicTreeRadial';
import { TopicTreeIndented } from './components/TopicTreeIndented';
import { MessageStreamTable } from './components/MessageStreamTable';
import { PacketInspector } from './components/PacketInspector';
import { FleetControls } from './components/FleetControls';
import { PublishTestBench } from './components/PublishTestBench';
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
    connectBroker,
    disconnectBroker,
    publishMessage,
    clearTree,
    startSimulator,
    stopSimulator,
    resetSimulator,
    updateSimulatorConfig,
    toggleEmbeddedBroker
  } = useMqttStream();

  const [activeView, setActiveView] = useState<'radial' | 'indented' | 'simulator' | 'publisher'>('radial');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const handleSelectMessage = (msg: InboundMessage) => {
    setSelectedMessage(msg);
  };

  const handleCloseInspector = () => {
    setSelectedMessage(null);
  };

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
      />

      {/* Main Workspace Workspace */}
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
    </div>
  );
}

export default App;
