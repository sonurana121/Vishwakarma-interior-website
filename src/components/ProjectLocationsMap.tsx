import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { ArrowUpRight, ExternalLink, MapPin } from 'lucide-react';
import type { Project, ProjectLocation } from '../types.ts';
import { ResilientImage } from './ResilientImage.tsx';

const CUTTACK_CENTER = { lat: 20.4625, lng: 85.883 };

interface ProjectLocationsMapProps {
  mapsApiKey: string;
  locations: ProjectLocation[];
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

function MapsStatusMonitor({ onStatusError }: { onStatusError: () => void }) {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      onStatusError();
    }
  }, [status, onStatusError]);
  return null;
}

function MapCameraController({
  targetCenter,
  targetZoom,
}: {
  targetCenter: { lat: number; lng: number };
  targetZoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(targetCenter);
    map.setZoom(targetZoom);
  }, [map, targetCenter, targetZoom]);
  return null;
}

interface LocationMarkerProps {
  location: ProjectLocation;
  locationProjects: Project[];
  isSelected: boolean;
  isInfoOpen: boolean;
  onMarkerClick: () => void;
  onCloseInfo: () => void;
  onSelectProject: (project: Project) => void;
}

function LocationMarker({
  location,
  locationProjects,
  isSelected,
  isInfoOpen,
  onMarkerClick,
  onCloseInfo,
  onSelectProject,
}: LocationMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const leadProject = locationProjects[0];

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: location.lat, lng: location.lng }}
        onClick={onMarkerClick}
        title={`${location.area_name}, ${location.city}`}
      >
        <Pin
          background={isSelected ? '#9E6B3B' : '#171614'}
          borderColor={isSelected ? '#6F4822' : '#0A0A09'}
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.2 : 1.0}
        />
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={270} onCloseClick={onCloseInfo}>
          <div className="p-1 text-[#171614] space-y-2">
            <div>
              <p className="text-xs font-medium text-[#9E6B3B]">{location.city}</p>
              <h4 className="text-sm font-semibold leading-snug">{location.area_name}</h4>
              <p className="text-xs text-[#5C574F] mt-0.5 tabular-nums">
                {locationProjects.length} completed {locationProjects.length === 1 ? 'project' : 'projects'}
              </p>
            </div>
            {leadProject && (
              <div className="space-y-1.5">
                <div className="w-full h-24 rounded overflow-hidden bg-[#ECE8E1]">
                  <img
                    src={leadProject.after_image}
                    alt={leadProject.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onSelectProject(leadProject)}
                  className="w-full text-left text-xs font-semibold text-[#9E6B3B] hover:underline flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="truncate">{leadProject.title}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function ProjectLocationsMap({
  mapsApiKey,
  locations,
  projects,
  onSelectProject,
}: ProjectLocationsMapProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | 'all'>('all');
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const selectedLocation = useMemo(
    () => (selectedLocationId === 'all' ? null : locations.find((l) => l.id === selectedLocationId) ?? null),
    [locations, selectedLocationId]
  );

  const filteredProjects = useMemo(() => {
    if (selectedLocationId === 'all') return projects;
    return projects.filter((p) => {
      if (p.location_id === selectedLocationId) return true;
      if (selectedLocation) {
        return p.location_name.toLowerCase().includes(selectedLocation.area_name.toLowerCase());
      }
      return false;
    });
  }, [projects, selectedLocationId, selectedLocation]);

  const targetCenter = useMemo(
    () => (selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : CUTTACK_CENTER),
    [selectedLocation]
  );
  const targetZoom = selectedLocation ? 14 : 12;

  const handleSelectLocation = useCallback((locId: string | 'all') => {
    setSelectedLocationId(locId);
    setOpenInfoId(locId === 'all' ? null : locId);
  }, []);

  const handleStatusError = useCallback(() => {
    setMapFailed(true);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleSelectLocation('all')}
          className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            selectedLocationId === 'all'
              ? 'bg-[#171614] text-white border-[#171614]'
              : 'bg-white text-[#5C574F] border-[#E2DDD4] hover:text-[#171614] hover:border-[#C9C1B4]'
          }`}
        >
          All Cuttack Areas ({projects.length})
        </button>
        {locations.map((loc) => {
          const count = projects.filter(
            (p) =>
              p.location_id === loc.id ||
              p.location_name.toLowerCase().includes(loc.area_name.toLowerCase())
          ).length;
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() => handleSelectLocation(loc.id)}
              className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                selectedLocationId === loc.id
                  ? 'bg-[#9E6B3B] text-white border-[#9E6B3B]'
                  : 'bg-white text-[#5C574F] border-[#E2DDD4] hover:text-[#171614] hover:border-[#C9C1B4]'
              }`}
            >
              {loc.area_name} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-xl overflow-hidden border border-[#E2DDD4] bg-[#ECE8E1] h-[420px] lg:h-[520px] relative">
          {mapsApiKey && !mapFailed ? (
            <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="IN">
              <MapsStatusMonitor onStatusError={handleStatusError} />
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={CUTTACK_CENTER}
                defaultZoom={12}
                gestureHandling="greedy"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                <MapCameraController targetCenter={targetCenter} targetZoom={targetZoom} />
                {locations.map((loc) => {
                  const locProjects = projects.filter(
                    (p) =>
                      p.location_id === loc.id ||
                      p.location_name.toLowerCase().includes(loc.area_name.toLowerCase())
                  );
                  return (
                    <LocationMarker
                      key={loc.id}
                      location={loc}
                      locationProjects={locProjects}
                      isSelected={selectedLocationId === loc.id}
                      isInfoOpen={openInfoId === loc.id}
                      onMarkerClick={() => handleSelectLocation(loc.id)}
                      onCloseInfo={() => setOpenInfoId(null)}
                      onSelectProject={onSelectProject}
                    />
                  );
                })}
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col justify-between p-6 bg-[#EFECE6]">
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#9E6B3B]">
                  Cuttack &amp; Odisha Service Territory
                </p>
                <h4 className="text-xl font-semibold text-[#171614]">
                  Completed Site Locations
                </h4>
                <p className="text-sm text-[#5C574F] max-w-md">
                  Select any neighborhood below to inspect completed interior work, photographs, and exact coordinates in Google Maps.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 overflow-y-auto">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectLocation(loc.id)}
                    className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      selectedLocationId === loc.id
                        ? 'bg-white border-[#9E6B3B]'
                        : 'bg-white/80 border-[#E2DDD4] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#171614]">{loc.area_name}</span>
                      <span className="text-xs font-mono-tabular text-[#5C574F]">
                        {loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}
                      </span>
                    </div>
                    <p className="text-xs text-[#5C574F] mt-1 line-clamp-1">{loc.description}</p>
                  </button>
                ))}
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${targetCenter.lat},${targetCenter.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#9E6B3B] hover:underline w-fit"
              >
                Open {selectedLocation ? selectedLocation.area_name : 'Cuttack'} in Google Maps
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E2DDD4] rounded-xl p-5 flex flex-col justify-between h-[420px] lg:h-[520px]">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EFECE6]">
            <div>
              <h3 className="text-lg font-semibold text-[#171614]">
                {selectedLocation ? `${selectedLocation.area_name}, ${selectedLocation.city}` : 'All Completed Locations'}
              </h3>
              <p className="text-xs text-[#5C574F] mt-0.5 tabular-nums">
                {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} available to inspect
              </p>
            </div>
            {selectedLocation && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${selectedLocation.lat},${selectedLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#9E6B3B] hover:underline whitespace-nowrap shrink-0"
              >
                Directions
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {filteredProjects.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MapPin className="w-6 h-6 text-[#9E6B3B] mb-2" />
                <p className="text-sm font-medium text-[#171614]">No projects mapped to this area yet</p>
                <p className="text-xs text-[#5C574F] mt-1">
                  Select another Cuttack area or view all projects.
                </p>
              </div>
            ) : (
              filteredProjects.map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => onSelectProject(proj)}
                  className="w-full text-left flex gap-3.5 p-2.5 rounded-lg border border-[#EFECE6] hover:border-[#C9C1B4] hover:bg-[#F9F8F6] transition-colors cursor-pointer group"
                >
                  <div className="w-24 h-20 rounded-md overflow-hidden bg-[#ECE8E1] shrink-0">
                    <ResilientImage
                      src={proj.after_image}
                      alt={proj.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-[#9E6B3B] font-medium truncate">
                        {proj.work_type} · {proj.location_name}
                      </div>
                      <h4 className="text-sm font-semibold text-[#171614] leading-snug line-clamp-2 group-hover:text-[#9E6B3B] transition-colors mt-0.5">
                        {proj.title}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#5C574F] tabular-nums mt-1">
                      <span>Completed {proj.completion_date}</span>
                      <span className="text-[#171614] font-medium inline-flex items-center gap-0.5">
                        Photos <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
