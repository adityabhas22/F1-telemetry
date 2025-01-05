from fastapi import APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import pandas as pd
from typing import List, Optional, Dict
from pydantic import BaseModel
from app.cache_manager import CacheManager
import asyncio
from datetime import datetime, timedelta

router = APIRouter(prefix="/races", tags=["races"])
cache_manager = CacheManager()

class DriverResult(BaseModel):
    position: Optional[int]
    driver_number: Optional[str]
    driver_name: Optional[str]
    team: Optional[str]
    grid_position: Optional[int]
    status: Optional[str]
    points: Optional[float]
    fastest_lap: Optional[bool]
    fastest_lap_time: Optional[str]
    laps_completed: Optional[int]
    q1_time: Optional[str]
    q2_time: Optional[str]
    q3_time: Optional[str]

class RaceResult(BaseModel):
    race_name: str
    date: str
    results: List[DriverResult]

@router.get("/calendar/{year}")
async def get_race_calendar(year: int):
    cache_key = f"calendar:{year}"
    
    # Try to get from cache first
    cached_data = await cache_manager.get_cached_data(cache_key)
    if cached_data:
        return cached_data
        
    try:
        schedule = fastf1.get_event_schedule(year)
        races = []
        
        for _, event in schedule.iterrows():
            if 'Testing' in event['OfficialEventName']:
                continue
                
            race_info = {
                "round": int(event['RoundNumber']),
                "race_name": event['OfficialEventName'],
                "circuit_name": event['Location'],
                "country": event['Country'],
                "date": event['EventDate'].strftime("%Y-%m-%d"),
                "available_sessions": ['R', 'Q']
            }
            races.append(race_info)
        
        # Cache the results for 24 hours
        await cache_manager.set_cached_data(cache_key, races, ttl=86400)
        return races
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not find races for year {year}")

@router.get("/results")
async def get_race_results(
    year: int,
    race_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    cache_key = f"results:{year}:{race_name}"
    
    # Try to get from cache first
    cached_data = await cache_manager.get_cached_data(cache_key)
    if cached_data:
        # Apply pagination to cached data
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        return {
            **cached_data,
            "results": cached_data["results"][start_idx:end_idx],
            "page": page,
            "total_pages": (len(cached_data["results"]) + page_size - 1) // page_size
        }
    
    try:
        schedule = fastf1.get_event_schedule(year)
        race_info = schedule[schedule['OfficialEventName'] == race_name].iloc[0]
        round_number = int(race_info['RoundNumber'])
        
        session = fastf1.get_session(year, round_number, 'R')
        session.load()
        
        results = []
        for _, driver in session.results.iterrows():
            fastest_lap = False
            if pd.notna(driver.get('FastestLap')):
                try:
                    fastest_lap = bool(int(driver['FastestLap']))
                except:
                    fastest_lap = bool(driver['FastestLap'])

            result = {
                "position": int(driver['Position']) if pd.notna(driver.get('Position')) else None,
                "driver_number": str(driver['DriverNumber']) if pd.notna(driver.get('DriverNumber')) else None,
                "driver_name": driver['FullName'] if pd.notna(driver.get('FullName')) else None,
                "team": driver['TeamName'] if pd.notna(driver.get('TeamName')) else None,
                "grid_position": int(driver['GridPosition']) if pd.notna(driver.get('GridPosition')) else None,
                "status": driver['Status'] if pd.notna(driver.get('Status')) else None,
                "points": float(driver['Points']) if pd.notna(driver.get('Points')) else None,
                "fastest_lap": fastest_lap,
                "fastest_lap_time": str(driver['FastestLapTime']) if pd.notna(driver.get('FastestLapTime')) else None,
                "laps_completed": int(driver['NumberOfLaps']) if pd.notna(driver.get('NumberOfLaps')) else None
            }
            results.append(result)
        
        full_response = {
            "race_name": race_name,
            "date": race_info['EventDate'].strftime("%Y-%m-%d"),
            "results": results
        }
        
        # Cache the full results for 24 hours
        await cache_manager.set_cached_data(cache_key, full_response, ttl=86400)
        
        # Apply pagination
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        return {
            **full_response,
            "results": results[start_idx:end_idx],
            "page": page,
            "total_pages": (len(results) + page_size - 1) // page_size
        }
        
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not find race results for {race_name} in {year}")

@router.get("/qualifying-results")
def get_qualifying_results(year: int, race_name: str):
    try:
        schedule = fastf1.get_event_schedule(year)
        race_info = schedule[schedule['OfficialEventName'] == race_name].iloc[0]
        round_number = int(race_info['RoundNumber'])
        
        session = fastf1.get_session(year, round_number, 'Q')
        session.load()
        
        results = []
        for _, driver in session.results.iterrows():
            result = {
                "position": int(driver['Position']) if pd.notna(driver.get('Position')) else None,
                "driver_number": str(driver['DriverNumber']) if pd.notna(driver.get('DriverNumber')) else None,
                "driver_name": driver['FullName'] if pd.notna(driver.get('FullName')) else None,
                "team": driver['TeamName'] if pd.notna(driver.get('TeamName')) else None,
                "q1_time": str(driver['Q1']) if pd.notna(driver.get('Q1')) else None,
                "q2_time": str(driver['Q2']) if pd.notna(driver.get('Q2')) else None,
                "q3_time": str(driver['Q3']) if pd.notna(driver.get('Q3')) else None,
                "fastest_lap_time": str(driver['BestLapTime']) if pd.notna(driver.get('BestLapTime')) else None
            }
            results.append(result)
            
        return {
            "race_name": race_name,
            "date": race_info['EventDate'].strftime("%Y-%m-%d"),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not find qualifying results for {race_name} in {year}")

@router.get("/lap-times")
def get_lap_times(year: int, race_name: str, driver_number: str, session_type: str):
    try:
        schedule = fastf1.get_event_schedule(year)
        race_info = schedule[schedule['OfficialEventName'] == race_name].iloc[0]
        round_number = int(race_info['RoundNumber'])
        
        # Use 'Q' for qualifying, 'R' for race
        session_identifier = 'Q' if session_type.lower() == 'qualifying' else 'R'
        session = fastf1.get_session(year, round_number, session_identifier)
        session.load()
        
        laps = session.laps.pick_driver(driver_number)
        
        # For qualifying, we need to filter for hot laps and remove outliers
        if session_identifier == 'Q':
            # Get the fastest valid lap time
            valid_laps = laps[pd.notna(laps['LapTime'])]
            if len(valid_laps) == 0:
                return {
                    "race_name": race_name,
                    "driver_number": driver_number,
                    "lap_times": []
                }
            
            fastest_time = valid_laps['LapTime'].min()
            # Convert timedelta to seconds for comparison
            fastest_seconds = fastest_time.total_seconds()
            # Filter laps: must be within 3 seconds of fastest lap and not too fast
            filtered_laps = valid_laps[
                (valid_laps['LapTime'].apply(lambda x: x.total_seconds()) <= fastest_seconds + 3) &  # Not too slow
                (valid_laps['LapTime'].apply(lambda x: x.total_seconds()) >= fastest_seconds - 3)    # Not too fast
            ]
            laps_to_process = filtered_laps
        else:
            # For race, use all valid laps
            laps_to_process = laps
        
        return {
            "race_name": race_name,
            "driver_number": driver_number,
            "lap_times": [
                {
                    "lap_number": int(lap['LapNumber']),
                    "lap_time": str(lap['LapTime']),
                    "sector_1": str(lap['Sector1Time']),
                    "sector_2": str(lap['Sector2Time']),
                    "sector_3": str(lap['Sector3Time']),
                    "is_personal_best": bool(lap['IsPersonalBest']),
                    "compound": lap['Compound']
                }
                for _, lap in laps_to_process.iterrows()
                if pd.notna(lap['LapTime'])
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Could not find lap times for driver {driver_number} in {race_name} {year}")

@router.get("/telemetry")
def get_telemetry(year: int, race_name: str, driver_number: str, lap_number: int, session_type: str):
    try:
        print(f"Loading telemetry for Year: {year}, Race: {race_name}, Driver: {driver_number}, Lap: {lap_number}, Session: {session_type}")
        schedule = fastf1.get_event_schedule(year)
        race_info = schedule[schedule['OfficialEventName'] == race_name].iloc[0]
        round_number = int(race_info['RoundNumber'])
        
        print(f"Found race info - Round number: {round_number}")
        
        # Use 'Q' for qualifying, 'R' for race
        session_identifier = 'Q' if session_type.lower() == 'qualifying' else 'R'
        print(f"Loading session: {session_identifier}")
        session = fastf1.get_session(year, round_number, session_identifier)
        session.load()
        
        print(f"Getting laps for driver {driver_number}")
        laps = session.laps.pick_driver(driver_number)
        print(f"Found {len(laps)} laps for driver")
        
        print(f"Getting lap {lap_number}")
        lap = laps.pick_lap(lap_number)
        print(f"Getting telemetry for lap")
        telemetry = lap.get_telemetry()
        print(f"Found {len(telemetry)} telemetry points")
        
        return {
            "race_name": race_name,
            "driver_number": driver_number,
            "lap_number": lap_number,
            "telemetry": [
                {
                    "distance": float(t['Distance']),
                    "speed": float(t['Speed']),
                    "rpm": float(t['RPM']) if pd.notna(t.get('RPM')) else None,
                    "gear": int(t['nGear']) if pd.notna(t.get('nGear')) else None,
                    "throttle": float(t['Throttle']) if pd.notna(t.get('Throttle')) else None,
                    "brake": float(t['Brake']) if pd.notna(t.get('Brake')) else None,
                    "drs": int(t['DRS']) if pd.notna(t.get('DRS')) else None
                }
                for _, t in telemetry.iterrows()
            ]
        }
    except Exception as e:
        print(f"Error in telemetry endpoint: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Could not find telemetry for driver {driver_number} lap {lap_number} in {race_name} {year}. Error: {str(e)}") 