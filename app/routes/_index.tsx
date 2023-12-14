import { LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import * as XLSX from 'xlsx';
import { useState, ChangeEvent, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { openConfigFiles } from '~/lib/functions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';

type SheetData = { [key: string]: any };

export async function loader({}: LoaderFunctionArgs) {
  // fetch external file from data directory
  const getConfig = await openConfigFiles();
  return {
    getConfig: getConfig,
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const data = JSON.parse(form.get('data') as string);
  console.log(data[1]);
  return null;
};

export default function Index() {
  const dataFromLoader = useLoaderData<typeof loader>();
  const [data, setData] = useState<SheetData[]>([]);
  const [interval, setInterval] = useState<string[]>([]);
  const [selectCyclicValues, setSelectCyclicValues] = useState<
    Array<{ interval: string; TYPE: string; VALUES: string; MINORHOURS: string; TIMEZONE: string }>
  >([]);
  console.log(selectCyclicValues);
  useEffect(() => {
    if (data.length > 0 && dataFromLoader.getConfig) {
      let intervals: string[] = [];
      data.forEach(async (job) => {
        if (job.Z && !intervals.includes(job.Z)) {
          intervals.push(job.Z);
        }
      });
      setInterval(intervals);
    }
  }, [data]);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsBinaryString(file);
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const binaryStr = event.target?.result;
      if (typeof binaryStr === 'string') {
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData: SheetData[] = XLSX.utils.sheet_to_json(sheet, { range: 3, header: 'A' });
        setData(parsedData);
      }
    };
  };

  return (
    <main className="flex flex-col gap-y-5 w-full">
      <h1 className="p-3 font-bold">Welcome to Remix</h1>
      {/* {dataFromLoader.getConfig && <p>User data path: {JSON.stringify(dataFromLoader.getConfig)}</p>} */}
      <div className="flex gap-x-5 items-end justify-center">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="excel">Excel template</Label>
          <Input
            id="excel"
            type="file"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={handleFileUpload}
          />
        </div>
      </div>
      {data.length > 0 && (
        <div className="w-full flex flex-col gap-y-2 ">
          <p className="flex gap-x-3 justify-center text-sm">Loaded jobs: {data.length}</p>
          <form className="flex flex-col gap-y-2 justify-center items-center">
            <div className="grid w-full items-center gap-1.5 max-w-sm">
              <Label htmlFor="nodeid">NodeId</Label>
              <Input id="nodeid" type="text" placeholder="Set NODEID" />
            </div>
            <Separator className="my-4" />
            {interval?.map((interval, index) => {
              const currentInterval = selectCyclicValues.find((item) => item.interval === interval) || {
                interval: { interval },
                TYPE: 'cyclic',
                VALUES: '',
                MINORHOURS: 'minutes',
                TIMEZONE: 'cst',
              };
              return (
                <div key={index} className="grid w-full justify-center items-center gap-1.5">
                  <Label className="text-xs" htmlFor={index.toString()}>
                    Correct cyclic intervals
                  </Label>
                  <p className="text-xs">{interval}</p>
                  <div className="flex gap-x-1">
                    <Select
                      name="cyclic"
                      defaultValue={currentInterval.TYPE}
                      onValueChange={(value) => {
                        const newSelectValues = [...selectCyclicValues];
                        const existingIntervalIndex = newSelectValues.findIndex((item) => item.interval === interval);
                        if (existingIntervalIndex > -1) {
                          if (value === 'sequence') {
                            newSelectValues[existingIntervalIndex].TIMEZONE = currentInterval.TIMEZONE;
                          } else {
                            newSelectValues[existingIntervalIndex].MINORHOURS = currentInterval.MINORHOURS;
                          }
                          newSelectValues[existingIntervalIndex].TYPE = value;
                        } else {
                          if (value === 'sequence') {
                            newSelectValues.push({
                              interval,
                              TYPE: value,
                              VALUES: currentInterval.VALUES,
                              MINORHOURS: currentInterval.MINORHOURS,
                              TIMEZONE: currentInterval.TIMEZONE,
                            });
                          } else {
                            newSelectValues.push({
                              interval,
                              TYPE: value,
                              VALUES: currentInterval.VALUES,
                              MINORHOURS: currentInterval.MINORHOURS,
                              TIMEZONE: currentInterval.TIMEZONE,
                            });
                          }
                        }
                        setSelectCyclicValues(newSelectValues);
                      }}
                    >
                      <SelectTrigger className="w-[110px]">
                        <SelectValue placeholder="Cyclic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cyclic">Cyclic</SelectItem>
                        <SelectItem value="sequence">Sequence</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id={index.toString()}
                      type="text"
                      placeholder={
                        currentInterval.TYPE === 'cyclic' ? 'Set cyclic value' : 'Set sequence values delimited by ,'
                      }
                      name="corrected"
                      className="w-[500px]"
                      value={currentInterval.VALUES}
                      onChange={(e) => {
                        const newSelectValues = [...selectCyclicValues];
                        const existingIntervalIndex = newSelectValues.findIndex((item) => item.interval === interval);
                        if (existingIntervalIndex > -1) {
                          newSelectValues[existingIntervalIndex].VALUES = e.target.value;
                        } else {
                          newSelectValues.push({
                            interval,
                            TYPE: currentInterval.TYPE,
                            VALUES: e.target.value,
                            MINORHOURS: currentInterval.MINORHOURS,
                            TIMEZONE: currentInterval.TIMEZONE,
                          });
                        }
                        setSelectCyclicValues(newSelectValues);
                      }}
                    />
                    {currentInterval.TYPE === 'cyclic' ? (
                      <Select
                        name="cyclic-c"
                        defaultValue={currentInterval.MINORHOURS}
                        value={currentInterval.MINORHOURS}
                        onValueChange={(value) => {
                          const newSelectValues = [...selectCyclicValues];
                          const existingIntervalIndex = newSelectValues.findIndex((item) => item.interval === interval);
                          if (existingIntervalIndex > -1) {
                            newSelectValues[existingIntervalIndex].MINORHOURS = value;
                          } else {
                            newSelectValues.push({
                              interval,
                              TYPE: currentInterval.TYPE,
                              VALUES: currentInterval.VALUES,
                              MINORHOURS: value,
                              TIMEZONE: currentInterval.TIMEZONE,
                            });
                          }
                          setSelectCyclicValues(newSelectValues);
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="minutes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutes">Minutes</SelectItem>
                          <SelectItem value="hours">Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        name="cyclic-t"
                        value={currentInterval.TIMEZONE}
                        defaultValue={currentInterval.TIMEZONE}
                        onValueChange={(value) => {
                          const newSelectValues = [...selectCyclicValues];
                          const existingIntervalIndex = newSelectValues.findIndex((item) => item.interval === interval);
                          if (existingIntervalIndex > -1) {
                            newSelectValues[existingIntervalIndex].TIMEZONE = value;
                          } else {
                            newSelectValues.push({
                              interval,
                              TYPE: currentInterval.TYPE,
                              VALUES: currentInterval.VALUES,
                              MINORHOURS: currentInterval.MINORHOURS,
                              TIMEZONE: value,
                            });
                          }
                          setSelectCyclicValues(newSelectValues);
                        }}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cst">CST</SelectItem>
                          <SelectItem value="est">EST</SelectItem>
                          <SelectItem value="cet">CET</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })}
          </form>
        </div>
      )}
      <Form method="post">
        <input hidden name="data" type="text" value={JSON.stringify(data)} readOnly />
        <Button type="submit">Submit</Button>
      </Form>
    </main>
  );
}
