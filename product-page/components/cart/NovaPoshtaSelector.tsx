'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
import type { NovaPoshtaCity, NovaPoshtaPoint } from '@/lib/cart/types';

interface NovaPoshtaSelectorProps {
  allowPostomat: boolean;
  cityRef: string;
  pointRef: string;
  onCityChange: (ref: string) => void;
  onPointChange: (ref: string) => void;
}

export default function NovaPoshtaSelector({
  allowPostomat,
  cityRef,
  pointRef,
  onCityChange,
  onPointChange,
}: NovaPoshtaSelectorProps) {
  const [cityQuery, setCityQuery] = useState('');
  const [pointQuery, setPointQuery] = useState('');
  const [cities, setCities] = useState<NovaPoshtaCity[]>([]);
  const [points, setPoints] = useState<NovaPoshtaPoint[]>([]);
  const [selectedCity, setSelectedCity] = useState<NovaPoshtaCity | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<NovaPoshtaPoint | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [pointLoading, setPointLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCity || cityQuery.trim().length < 2) {
      setCities([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCityLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/nova-poshta/cities?q=${encodeURIComponent(cityQuery.trim())}`, { signal: controller.signal });
        const payload = await response.json() as NovaPoshtaCity[] | { error?: string };
        if (!response.ok) throw new Error(Array.isArray(payload) ? undefined : payload.error);
        setCities(payload as NovaPoshtaCity[]);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Не вдалося знайти місто.');
      } finally {
        if (!controller.signal.aborted) setCityLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [cityQuery, selectedCity]);

  useEffect(() => {
    if (!cityRef || selectedPoint || pointQuery.trim().length < 1) {
      setPoints([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPointLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          city: cityRef,
          q: pointQuery.trim(),
          postomat: allowPostomat ? '1' : '0',
        });
        const response = await fetch(`/api/nova-poshta/points?${params}`, { signal: controller.signal });
        const payload = await response.json() as NovaPoshtaPoint[] | { error?: string };
        if (!response.ok) throw new Error(Array.isArray(payload) ? undefined : payload.error);
        setPoints(payload as NovaPoshtaPoint[]);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Не вдалося знайти відділення.');
      } finally {
        if (!controller.signal.aborted) setPointLoading(false);
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [allowPostomat, cityRef, pointQuery, selectedPoint]);

  useEffect(() => {
    if (selectedPoint?.type === 'postomat' && !allowPostomat) {
      setSelectedPoint(null);
      setPointQuery('');
      onPointChange('');
    }
  }, [allowPostomat, onPointChange, selectedPoint]);

  const chooseCity = (city: NovaPoshtaCity) => {
    setSelectedCity(city);
    setCityQuery(`${city.name}${city.area ? `, ${city.area} обл.` : ''}`);
    setCities([]);
    setSelectedPoint(null);
    setPointQuery('');
    onCityChange(city.ref);
    onPointChange('');
  };

  const choosePoint = (point: NovaPoshtaPoint) => {
    setSelectedPoint(point);
    setPointQuery(point.name);
    setPoints([]);
    onPointChange(point.ref);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="np-city" className="mb-1.5 block text-sm font-medium text-gray-900">Місто *</label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3.5 text-gray-400" size={17} />
          <input
            id="np-city"
            value={cityQuery}
            onChange={event => {
              setCityQuery(event.target.value);
              setSelectedCity(null);
              setSelectedPoint(null);
              setPointQuery('');
              onCityChange('');
              onPointChange('');
            }}
            placeholder="Почніть вводити місто"
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-base outline-none transition focus:border-gray-500 sm:text-sm"
          />
          {cityLoading && <Loader2 className="absolute right-3 top-3.5 animate-spin text-gray-400" size={17} />}
          {selectedCity && <Check className="absolute right-3 top-3.5 text-[#159e85]" size={17} />}
        </div>
        {cities.length > 0 && (
          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {cities.map(city => (
              <button key={city.ref} type="button" onClick={() => chooseCity(city)} className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100">
                <span className="font-medium">{city.type} {city.name}</span>
                {city.area && <span className="ml-1 text-gray-500">({city.area} обл.)</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label htmlFor="np-point" className="mb-1.5 block text-sm font-medium text-gray-900">
          {allowPostomat ? 'Відділення або поштомат *' : 'Відділення *'}
        </label>
        <div className="relative">
          <input
            id="np-point"
            value={pointQuery}
            disabled={!cityRef}
            onChange={event => {
              setPointQuery(event.target.value);
              setSelectedPoint(null);
              onPointChange('');
            }}
            placeholder={cityRef ? 'Номер або адреса відділення' : 'Спочатку оберіть місто'}
            autoComplete="off"
            className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 pr-10 text-base outline-none transition focus:border-gray-500 disabled:bg-gray-100 sm:text-sm"
          />
          {pointLoading && <Loader2 className="absolute right-3 top-3.5 animate-spin text-gray-400" size={17} />}
          {selectedPoint && <Check className="absolute right-3 top-3.5 text-[#159e85]" size={17} />}
        </div>
        {points.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
            {points.map(point => (
              <button key={point.ref} type="button" onClick={() => choosePoint(point)} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-gray-100">
                <span className="block text-sm font-medium">{point.name}</span>
                {point.address !== point.name && <span className="mt-0.5 block text-xs text-gray-500">{point.address}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!allowPostomat && cityRef && (
        <p className="text-xs leading-5 text-gray-500">Для цього замовлення доступна доставка у відповідне відділення.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input type="hidden" value={pointRef} readOnly />
    </div>
  );
}
