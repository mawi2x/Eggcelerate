"""Measure raw versus bounded chart DB+JSON work on 1/12/100 disposable chambers.

Uses a unique farm with 21 days of 30-second synthetic data (6,048,000 samples).
Run PYTHONPATH=apps/api/src TEST_DATABASE_URL=... apps/api/.venv/bin/python FILE.
Never targets the main/local/production database. Leaves only its unique test farm.
"""
import asyncio
import gzip
import json
import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.engine import make_url

from eggcelerate_api.database.readings import query_readings
from eggcelerate_api.database.readings_scale import chart
from eggcelerate_api.database.schema import incubators
from eggcelerate_api.database.store import PostgresStore

URL = os.environ['TEST_DATABASE_URL']
parsed = make_url(URL)
if parsed.database != 'eggcelerate_test' or parsed.port != 55432 or parsed.host not in {'127.0.0.1','localhost','::1'}:
    raise ValueError('Disposable loopback eggcelerate_test:55432 only')
reuse = os.environ.get("M4_BENCHMARK_FARM")
farm = reuse or str(uuid4())
end = datetime.fromisoformat(os.environ["M4_BENCHMARK_END"]) if reuse else datetime.now(UTC).replace(hour=0,minute=0,second=0,microsecond=0)
start = end-timedelta(days=21)


async def run():
    db = PostgresStore(URL,farm)
    try:
        if not reuse:
            await db.seed()
            async with db.sessions.begin() as session:
                await session.execute(text("""INSERT INTO devices(id,farm_id,public_id,paired) SELECT gen_random_uuid(),CAST(:farm AS uuid),'M4-'||n,true FROM generate_series(13,100) n"""), {'farm':farm})
                await session.execute(text("""INSERT INTO incubators(id,farm_id,public_id,position,name,mode_id,device_id,turn_interval_min,auto_turn)
                    SELECT gen_random_uuid(),d.farm_id,'chamber-'||n,n-1,'Chamber '||n,m.id,d.id,240,true
                    FROM generate_series(13,100) n JOIN devices d ON d.farm_id=CAST(:farm AS uuid) AND d.public_id='M4-'||n JOIN modes m ON m.farm_id=d.farm_id AND m.public_id='broiler'"""),{'farm':farm})
                await session.execute(text("UPDATE cycles SET started_on=:day WHERE farm_id=CAST(:farm AS uuid) AND status='active'"), {'farm':farm,'day':start.date().isoformat()})
                await session.execute(text("""INSERT INTO cycles(farm_id,id,incubator_id,started_on,status) SELECT i.farm_id,'m4-cycle-'||i.public_id,i.public_id,:day,'active' FROM incubators i WHERE i.farm_id=CAST(:farm AS uuid) AND NOT EXISTS(SELECT 1 FROM cycles c WHERE c.farm_id=i.farm_id AND c.incubator_id=i.public_id AND c.status='active')"""),{'farm':farm,'day':start.date().isoformat()})
                await session.execute(text("""INSERT INTO incubator_runtime(farm_id,incubator_id,cycle_id,day_of_incubation,total_eggs_loaded,cycle_phase,last_turned_at,next_turn_at) SELECT farm_id,incubator_id,id,21,10,'incubating',CAST(:end AS timestamptz),CAST(:end AS timestamptz) FROM cycles WHERE farm_id=CAST(:farm AS uuid) AND status='active' ON CONFLICT(farm_id,incubator_id) DO UPDATE SET cycle_id=excluded.cycle_id,day_of_incubation=21,cycle_phase='incubating'"""),{'farm':farm,'end':end})
                assert await session.scalar(text("SELECT count(*) FROM incubators WHERE farm_id=CAST(:farm AS uuid)"), {"farm":farm}) == 100
                for index in range(1,101):
                    await session.execute(text("""INSERT INTO telemetry_samples(farm_id,device_id,observed_at,received_at,temperature_c,humidity_pct,water_ok) SELECT i.farm_id,i.device_id,t,t,CASE WHEN extract(minute FROM t)=0 THEN 40 ELSE 37.6 END,57,true FROM incubators i CROSS JOIN generate_series(CAST(:start AS timestamptz),CAST(:end AS timestamptz)-interval '30 seconds', interval '30 seconds') t WHERE i.farm_id=CAST(:farm AS uuid) AND i.public_id=:chamber"""),{'farm':farm,'start':start,'end':end,'chamber':f'chamber-{index}'})
                    if index%10==0: print(f"Seeded {index}/100 chambers",flush=True)
        results=[]
        browser={}
        async with db.sessions() as session:
            units=(await session.execute(select(incubators.c.public_id,incubators.c.device_id).where(incubators.c.farm_id==db.farm_id).order_by(incubators.c.position))).all()
            assert len(units) == 100
            for count in (1,12,100):
                for window,days in (('24h',1),('7d',7),('full',21)):
                    for kind in ('raw','chart'):
                        query_ms=serialize_ms=0.0
                        points=bytes_count=gzip_bytes=0
                        for chamber,device in units[:count]:
                            before=time.perf_counter()
                            rows=await query_readings(session,db.farm_id,device,end-timedelta(days=days),end) if kind=='raw' else await chart(session,db.farm_id,chamber,window,end)
                            query_ms+=(time.perf_counter()-before)*1000
                            before=time.perf_counter()
                            wire=json.dumps({'ok':True,'data':rows},default=lambda value: value.isoformat(),separators=(',',':')).encode()
                            serialize_ms+=(time.perf_counter()-before)*1000
                            points+=len(rows); bytes_count+=len(wire); gzip_bytes+=len(gzip.compress(wire))
                            if kind=='chart' and count==100:
                                browser.setdefault(window,{})[chamber]=rows
                        item=dict(chambers=count,window=window,kind=kind,points=points,bytes=bytes_count,gzip_bytes=gzip_bytes,query_ms=round(query_ms,2),serialize_ms=round(serialize_ms,2))
                        results.append(item)
                        print(json.dumps(item),flush=True)
        output={'farm_id':farm,'start_utc':start.isoformat(),'end_utc':end.isoformat(),'cadence_seconds':30,'results':results}
        Path('output').mkdir(exist_ok=True)
        Path('output/m4-api-measurements.json').write_text(json.dumps(output,indent=2))
        Path('output/m4-chart-fixtures.json').write_text(json.dumps(browser,default=lambda value: value.isoformat()))
    finally:
        await db.close()

asyncio.run(run())
