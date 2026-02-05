import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';

interface StreamingContextType {
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;
  videoElement: HTMLVideoElement | HTMLDivElement | null;
  setVideoElement: (element: HTMLVideoElement | HTMLDivElement | null) => void;
  streamTitle: string;
  setStreamTitle: (title: string) => void;
  isViewerStream: boolean;
  setIsViewerStream: (value: boolean) => void;
  watchUrl: string;
  setWatchUrl: (url: string) => void;
  currentEvent: any;
  setCurrentEvent: (event: any) => void;
  streamingEventId: string | null;
  setStreamingEventId: (id: string | null) => void;
  streamingClient: any;
  setStreamingClient: (client: any) => void;
  streamingTracks: any;
  setStreamingTracks: (tracks: any) => void;
  streamingUid: number | null;
  setStreamingUid: (uid: number | null) => void;
}

const StreamingContext = createContext<StreamingContextType | undefined>(undefined);

export const StreamingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | HTMLDivElement | null>(null);
  const [streamTitle, setStreamTitle] = useState('');
  const [isViewerStream, setIsViewerStream] = useState(false);
  const [watchUrl, setWatchUrl] = useState('');
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [streamingEventId, setStreamingEventId] = useState<string | null>(null);
  const [streamingClient, setStreamingClient] = useState<any>(null);
  const [streamingTracks, setStreamingTracks] = useState<any>(null);
  const [streamingUid, setStreamingUid] = useState<number | null>(null);

  return (
    <StreamingContext.Provider
      value={{
        isStreaming,
        setIsStreaming,
        videoElement,
        setVideoElement,
        streamTitle,
        setStreamTitle,
        isViewerStream,
        setIsViewerStream,
        watchUrl,
        setWatchUrl,
        currentEvent,
        setCurrentEvent,
        streamingEventId,
        setStreamingEventId,
        streamingClient,
        setStreamingClient,
        streamingTracks,
        setStreamingTracks,
        streamingUid,
        setStreamingUid,
      }}
    >
      {children}
    </StreamingContext.Provider>
  );
};

export const useStreaming = () => {
  const context = useContext(StreamingContext);
  if (!context) {
    // Return default values instead of throwing to prevent crashes
    // This can happen during initial render or if component is outside provider
    console.warn('useStreaming called outside StreamingProvider - returning defaults');
    return {
      isStreaming: false,
      setIsStreaming: () => {},
      videoElement: null,
      setVideoElement: () => {},
      streamTitle: '',
      setStreamTitle: () => {},
      isViewerStream: false,
      setIsViewerStream: () => {},
      watchUrl: '',
      setWatchUrl: () => {},
      currentEvent: null,
      setCurrentEvent: () => {},
      streamingEventId: null,
      setStreamingEventId: () => {},
      streamingClient: null,
      setStreamingClient: () => {},
      streamingTracks: null,
      setStreamingTracks: () => {},
      streamingUid: null,
      setStreamingUid: () => {},
    };
  }
  return context;
};

