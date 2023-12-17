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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

type SheetData = { [key: string]: any };

type OncodeType = {
  oncode: string;
  rc: string;
  mailto: string;
  output: string;
  subject: string;
  message: string;
};

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
  const [oncode, setOncode] = useState<string[]>([]);
  const [updateOncode, setUpdateOncode] = useState<OncodeType[]>([]);
  const [selectCyclicValues, setSelectCyclicValues] = useState<
    Array<{ interval: string; TYPE: string; VALUES: string; MINORHOURS: string; TIMEZONE: string }>
  >([]);
  console.log(updateOncode);
  useEffect(() => {
    if (data.length > 0 && dataFromLoader.getConfig) {
      let intervals: string[] = [];
      let oncodes: string[] = [];
      data.forEach(async (job) => {
        if (job.Z && !intervals.includes(job.Z)) {
          intervals.push(job.Z);
        }
        if (job.BB) {
          // const regex = new RegExp(job.Q, 'g');
          // let modifiedJobName = job.BB.replace(regex, '%%JOBNAME');
          let modifiedJobName = job.BB.replace(/\b\w*_\w*\b/g, '%%JOBNAME');
          modifiedJobName = modifiedJobName.replace(/\s*([:@-])\s*/g, '$1');
          if (
            !oncodes
              .map((code) => code.toLowerCase().replace(/\s+/g, ''))
              .includes(modifiedJobName.toLowerCase().replace(/\s+/g, ''))
          ) {
            oncodes.push(modifiedJobName);
          }
        }
      });
      if (oncodes) {
        setUpdateOncode(
          oncodes.map((oncode) => ({
            oncode,
            rc: '',
            mailto: '',
            output: 'yes',
            subject: '',
            message: '',
          }))
        );
      }
      setInterval(intervals);
      setOncode(oncodes);
    }
  }, [data]);

  function updateValue(index: number, key: string, value: string) {
    setUpdateOncode((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

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
          <div className="flex flex-col gap-y-2 justify-center items-center">
            <Tabs defaultValue="nodeid" className="w-full">
              <TabsList className="flex grow">
                <TabsTrigger value="nodeid" className="grow">
                  NodeId
                </TabsTrigger>
                <TabsTrigger value="cyclic" className="grow">
                  Cyclic
                </TabsTrigger>
                <TabsTrigger value="oncode" className="grow">
                  On Code
                </TabsTrigger>
              </TabsList>
              <TabsContent value="nodeid">
                <div className="w-full flex grow items-center justify-center">
                  <div className="grid w-full  items-center gap-1.5 max-w-sm">
                    <Label htmlFor="nodeid">NodeId</Label>
                    <Input id="nodeid" type="text" placeholder="Set NODEID" />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="cyclic">
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
                            const existingIntervalIndex = newSelectValues.findIndex(
                              (item) => item.interval === interval
                            );
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
                            currentInterval.TYPE === 'cyclic'
                              ? 'Set cyclic value'
                              : 'Set sequence values delimited by ,'
                          }
                          name="corrected"
                          className="w-[500px]"
                          value={currentInterval.VALUES}
                          onChange={(e) => {
                            const newSelectValues = [...selectCyclicValues];
                            const existingIntervalIndex = newSelectValues.findIndex(
                              (item) => item.interval === interval
                            );
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
                              const existingIntervalIndex = newSelectValues.findIndex(
                                (item) => item.interval === interval
                              );
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
                              <SelectItem value="minutes">minutes</SelectItem>
                              <SelectItem value="hours">hours</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            name="cyclic-t"
                            value={currentInterval.TIMEZONE}
                            defaultValue={currentInterval.TIMEZONE}
                            onValueChange={(value) => {
                              const newSelectValues = [...selectCyclicValues];
                              const existingIntervalIndex = newSelectValues.findIndex(
                                (item) => item.interval === interval
                              );
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
                              <SelectItem value="cst">cst</SelectItem>
                              <SelectItem value="est">est</SelectItem>
                              <SelectItem value="cet">cet</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="oncode" className="flex flex-col gap-y-3">
                {updateOncode?.map((values, index) => {
                  return (
                    <div key={index} className="flex flex-col w-full gap-1.5 px-5">
                      <Label className="text-xs" htmlFor={index.toString()}>
                        Correct oncode
                      </Label>
                      <p className="text-xs whitespace-pre max-w-[500px] text-ellipsis">{values.oncode}</p>
                      <div className="flex flex-col gap-y-2">
                        <div className="flex gap-x-3">
                          <div className="grid w-full max-w-[100px] items-center gap-1.5">
                            <Label htmlFor="rc">Return code</Label>
                            <Input
                              id="rc"
                              placeholder="number"
                              type="number"
                              value={values.rc}
                              onChange={(e) => updateValue(index, 'rc', e.target.value)}
                            />
                          </div>
                          <div className="grid w-full max-w-[400px] items-center gap-1.5">
                            <Label htmlFor="mailto">Mailto</Label>
                            <Input
                              id="mailto"
                              placeholder="emails"
                              value={values.mailto}
                              onChange={(e) => updateValue(index, 'mailto', e.target.value)}
                            />
                          </div>
                          <div className="grid w-full max-w-[150px] items-center gap-1.5">
                            <Label htmlFor="output">Output</Label>
                            <Select defaultValue="yes" onValueChange={(value) => updateValue(index, 'output', value)}>
                              <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Attach output" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes">yes</SelectItem>
                                <SelectItem value="no">no</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-x-3">
                          <div className="grid w-full max-w-[330px] items-center gap-1.5">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                              id="subject"
                              placeholder="subject"
                              value={values.subject}
                              onChange={(e) => updateValue(index, 'subject', e.target.value)}
                            />
                          </div>
                          <div className="grid w-full max-w-[330px] items-center gap-1.5">
                            <Label htmlFor="message">Messsage</Label>
                            <Input
                              id="message"
                              placeholder="messsage"
                              value={values.message}
                              onChange={(e) => updateValue(index, 'message', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
      <Form method="post">
        <input hidden name="data" type="text" value={JSON.stringify(data)} readOnly />
        <Button type="submit">Submit</Button>
      </Form>
    </main>
  );
}
