import { type ActionFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import * as XLSX from 'xlsx';
import { useState, ChangeEvent, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { openConfigFiles, writeFileTest } from '~/lib/functions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import electron from '~/electron.server';

type SheetData = { [key: string]: any };

type OncodeType = {
  oncode: string;
  rc: string;
  mailto: string;
  output: string;
  subject: string;
  message: string;
};

type IntervalType = {
  interval: string;
  TYPE: string;
  VALUES: string;
  MINORHOURS: string;
  TIMEZONE: string;
};

type TimeFromType = {
  origTimeFrom: string;
  correctTimeFrom: string;
};

type TimeToType = {
  origTimeTo: string;
  correctTimeTo: string;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  // const xml_structure = JSON.parse(form.get('xml_structure') as string);
  const interval = JSON.parse(form.get('interval') as string) as IntervalType[];
  const oncode = JSON.parse(form.get('oncode') as string) as OncodeType[];
  const timeFrom = JSON.parse(form.get('timefrom') as string) as TimeFromType[];
  const timeTo = JSON.parse(form.get('timeto') as string) as TimeToType[];
  const nodeid = form.get('nodeid') as string;
  const sheet_data = JSON.parse(form.get('sheet_data') as string) as SheetData[];
  const isDev = process.env.NODE_ENV === 'development';
  const url = isDev ? 'http://localhost:3000' : 'http://localhost';
  const cookies = await electron.session.defaultSession.cookies.get({ url });
  const getDirFromCookie = cookies.find((cookie) => cookie.name === 'selectedDirectory');
  const xml_structure = await openConfigFiles(getDirFromCookie?.value!);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<DEFTABLE xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="Folder.xsd">\n`;

  let currentBD: string | null = null;

  sheet_data.forEach((item) => {
    const intervalKeys = ['CYCLIC', 'CYCLIC_TIMES_SEQUENCE', 'CYCLIC_TYPE', 'INTERVAL'];
    if (item.BD !== currentBD) {
      if (currentBD !== null) {
        // Close the current FOLDER tag if it's not the first item
        xml += '\t</FOLDER>\n';
      }

      // Start a new FOLDER tag
      xml += `\t<FOLDER ${Object.keys(xml_structure.FOLDER.attributes)
        .map((key) => {
          const attribute = xml_structure.FOLDER.attributes[key];
          let value;

          if ('default' in attribute) {
            value = attribute.default;
          } else if ('excel_column' in attribute) {
            value = item[attribute.excel_column];

            if ('enum' in attribute && value.split(' ')[1].toUpperCase() in attribute.enum) {
              value = attribute.enum[value.split(' ')[1].toUpperCase()];
            }
          }

          return `${key}="${value}"`;
        })
        .join(' ')}>\n`;

      currentBD = item.BD;
    }
    const sheetInterval = item.Z;
    // console.log(sheetInterval);
    xml += `\t\t<JOB `;

    for (const key of Object.keys(xml_structure.FOLDER.JOB.attributes)) {
      const attribute = xml_structure.FOLDER.JOB.attributes[key];
      // console.log(key, interval);
      let value = '';

      if (key === 'NODEID' && nodeid !== '') {
        value = nodeid;
        xml += `${key}="${value}" `;
        continue;
      }
      if (key === 'TIMEFROM') {
        if (timeFrom.length > 0) {
          const index = timeFrom.findIndex((tmfrom) => tmfrom.origTimeFrom === item.W);
          if (index !== -1 && timeFrom[index].correctTimeFrom !== '') {
            value = timeFrom[index].correctTimeFrom;
            xml += `${key}="${value}" `;
            continue;
          }
        }
      }
      if (key === 'TIMETO') {
        if (timeTo.length > 0) {
          const index = timeTo.findIndex((tmto) => tmto.origTimeTo === item.X);
          if (index !== -1 && timeTo[index].correctTimeTo !== '') {
            value = timeTo[index].correctTimeTo;
            xml += `${key}="${value}" `;
            continue;
          }
        }
      }

      if (intervalKeys.includes(key) && sheetInterval !== undefined) {
        const index = interval.findIndex((item) => item.interval === sheetInterval);
        if (index !== -1) {
          if (key === 'CYCLIC') {
            value = '1';
          } else if (key === 'CYCLIC_TYPE') {
            if (interval[index].TYPE === 'cyclic') {
              value = 'C';
            } else {
              value = 'S';
            }
          } else if (key === 'CYCLIC_TIMES_SEQUENCE') {
            if (interval[index].TYPE === 'sequence' && interval[index].VALUES !== undefined) {
              value = interval[index].VALUES;
            }
          } else if (key === 'INTERVAL') {
            if (interval[index].TYPE === 'cyclic' && interval[index].VALUES !== undefined) {
              let morh;
              if (interval[index].MINORHOURS === 'hours') {
                morh = 'H';
              } else {
                morh = 'M';
              }
              value = interval[index].VALUES.padStart(5, '0') + morh;
            }
          }
          xml += `${key}="${value}" `;
          continue;
        }
      }

      if ('default' in attribute) {
        value = attribute.default;
      } else if ('excel_column' in attribute) {
        value = item[attribute.excel_column] as string;
        if (value === undefined) {
          continue;
        }
        if ('enum' in attribute && value?.toUpperCase() in attribute.enum) {
          value = attribute.enum[value?.toUpperCase()];
        }
      }

      xml += `${key}="${value}" `;

      // Add your condition to break the loop
      // if (/* condition */) {
      //   break;
      // }
    }

    xml += `>\n`;

    xml_structure.FOLDER.JOB.VARIABLE.map((variable: any) => {
      const name = variable.attributes.NAME;
      let value;

      if ('default' in variable.attributes.VALUE) {
        value = variable.attributes.VALUE.default;
      } else if ('excel_column' in variable.attributes.VALUE) {
        value = item[variable.attributes.VALUE.excel_column];

        if ('enum' in variable.attributes.VALUE && value?.toUpperCase() in variable.attributes.VALUE.enum) {
          value = variable.attributes.VALUE.enum[value?.toUpperCase()];
        }
      }

      xml += `\t\t\t<VARIABLE NAME="${name}" VALUE="${value}" />\n`;
    });

    if (item.BG !== undefined) {
      const qrs = item.BG.split(/\s+/);
      qrs.forEach((qr: string) => {
        xml += `\t\t\t<QUANTITATIVE NAME="${qr}" QUANT="1" ONFAIL="R" ONOK="R" />\n`;
      });
    }

    if (item.BB !== undefined) {
      const on = xml_structure.FOLDER.JOB.ON;

      let modifiedJobName = item.BB.replace(/\b\w*_\w*\b/g, '%%JOBNAME');
      modifiedJobName = modifiedJobName.replace(/\s*([:@-])\s*/g, '$1');
      const index = oncode
        .map((code) => code.oncode.toLowerCase().replace(/\s+/g, ''))
        .findIndex((code) => code === modifiedJobName.toLowerCase().replace(/\s+/g, ''));
      if (index !== -1 && oncode[index].message !== '' && oncode[index].subject !== '' && oncode[index].mailto !== '') {
        xml += `\t\t\t<ON STMT="${on.attributes.STMT}" CODE="COMPSTAT EQ ${oncode[index].rc}" >\n`;
        xml += `\t\t\t\t<DOMAIL URGENCY="${on.DOMAIL.attributes.URGENCY}" DEST="${oncode[index].mailto}" SUBJECT="${
          oncode[index].subject
        }" MESSAGE="${oncode[index].message}" ATTACH_SYSOUT="${oncode[index].output === 'Yes' ? 'Y' : 'N'}" />\n`;
        xml += `\t\t\t</ON>\n`;
      } else {
        xml += `\t\t\t<ON STMT="${on.attributes.STMT}" CODE="${on.attributes.CODE}">\n`;
        xml += `\t\t\t\t<DOMAIL URGENCY="${on.DOMAIL.attributes.URGENCY}" DEST="${on.DOMAIL.attributes.DEST}" SUBJECT="${on.DOMAIL.attributes.SUBJECT}" MESSAGE="${on.DOMAIL.attributes.MESSAGE}" ATTACH_SYSOUT="${on.DOMAIL.attributes.ATTACH_SYSOUT}" />\n`;
        xml += `\t\t\t</ON>\n`;
      }
    }
    xml += '\t\t</JOB>\n';

    // Generate the rest of the XML for the item...
  });

  if (currentBD !== null) {
    // Close the last FOLDER tag
    xml += '\t</FOLDER>\n';
  }

  xml += `</DEFTABLE>`;
  writeFileTest(xml, getDirFromCookie?.value!);
  return null;
};

export default function Index() {
  // const dataFromLoader = useLoaderData<typeof loader>();
  const [data, setData] = useState<SheetData[]>([]);
  const [interval, setInterval] = useState<string[]>([]);
  const [timeFrom, setTimeFrom] = useState<Array<{ origTimeFrom: string; correctTimeFrom: string }>>([]);
  const [timeTo, setTimeTo] = useState<Array<{ origTimeTo: string; correctTimeTo: string }>>([]);
  const [nodeId, setNodeId] = useState<string>('');
  const [updateOncode, setUpdateOncode] = useState<OncodeType[]>([]);
  const [selectCyclicValues, setSelectCyclicValues] = useState<
    Array<{ interval: string; TYPE: string; VALUES: string; MINORHOURS: string; TIMEZONE: string }>
  >([]);

  useEffect(() => {
    if (data.length > 0) {
      let intervals: string[] = [];
      let timeFroms: string[] = [];
      let timeTos: string[] = [];
      let oncodes: string[] = [];
      data.forEach(async (job) => {
        if (job.Z && !intervals.includes(job.Z)) {
          intervals.push(job.Z);
        }
        if (job.W && !timeFroms.includes(job.W)) {
          timeFroms.push(job.W);
        }
        if (job.X && !timeTos.includes(job.X)) {
          timeTos.push(job.X);
        }
        if (job.BB) {
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
            rc: '1',
            mailto: '',
            output: 'yes',
            subject: '',
            message: '',
          }))
        );
      }
      setInterval(intervals);
      setTimeFrom(
        timeFroms.map((origTimeFrom) => ({
          origTimeFrom,
          correctTimeFrom: '',
        }))
      );
      setTimeTo(
        timeTos.map((origTimeTo) => ({
          origTimeTo,
          correctTimeTo: '',
        }))
      );
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
        const sortedData = [...parsedData].sort((a, b) => a.BD.localeCompare(b.BD));
        setData(sortedData);
      }
    };
  };

  return (
    <main className="flex flex-col gap-y-5 w-full">
      <div className="w-full flex justify-center items-center">
        <h1 className="p-3 font-bold ">Convert</h1>
      </div>
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
                {timeFrom.length > 0 && (
                  <TabsTrigger value="timefrom" className="grow">
                    TimeFrom
                  </TabsTrigger>
                )}
                {timeTo.length > 0 && (
                  <TabsTrigger value="timeto" className="grow">
                    TimeTo
                  </TabsTrigger>
                )}
                <TabsTrigger value="oncode" className="grow">
                  OnCode
                </TabsTrigger>
              </TabsList>
              <TabsContent value="nodeid">
                <div className="w-full flex grow items-center justify-center">
                  <div className="grid w-full  items-center gap-1.5 max-w-sm">
                    <Label htmlFor="nodeid">NodeId</Label>
                    <Input
                      id="nodeid"
                      type="text"
                      placeholder="Set NODEID"
                      value={nodeId}
                      onChange={(e) => setNodeId(e.target.value)}
                    />
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
              <TabsContent value="timefrom" className="flex flex-col gap-y-3 ">
                {timeFrom?.map((values, index) => {
                  return (
                    <div className="w-full flex grow items-center justify-center">
                      <div key={index} className="grid w-full  items-center gap-1.5 max-w-sm">
                        <Label className="text-xs" htmlFor={index.toString()}>
                          Correct time from
                        </Label>
                        <p className="text-xs whitespace-pre max-w-[500px] text-ellipsis">{values.origTimeFrom}</p>
                        <div className="flex gap-x-3">
                          <div className="grid w-full max-w-[330px] items-center gap-1.5">
                            <Label htmlFor="timefrom">Time from</Label>
                            <Input
                              id="timefrom"
                              placeholder="time from"
                              value={values.correctTimeFrom}
                              onChange={(e) => {
                                const newTimeFrom = [...timeFrom];
                                newTimeFrom[index].correctTimeFrom = e.target.value;
                                setTimeFrom(newTimeFrom);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
              <TabsContent value="timeto" className="flex flex-col gap-y-3">
                {timeTo?.map((values, index) => {
                  return (
                    <div className="w-full flex grow items-center justify-center">
                      <div key={index} className="grid w-full  items-center gap-1.5 max-w-sm">
                        <Label className="text-xs" htmlFor={index.toString()}>
                          Correct time to
                        </Label>
                        <p className="text-xs whitespace-pre max-w-[500px] text-ellipsis">{values.origTimeTo}</p>
                        <div className="flex gap-x-3">
                          <div className="grid w-full max-w-[330px] items-center gap-1.5">
                            <Label htmlFor="timeto">Time to</Label>
                            <Input
                              id="timeto"
                              placeholder="time to"
                              value={values.correctTimeTo}
                              onChange={(e) => {
                                const newTimeTo = [...timeTo];
                                newTimeTo[index].correctTimeTo = e.target.value;
                                setTimeTo(newTimeTo);
                              }}
                            />
                          </div>
                        </div>
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
          <Form method="post" className="flex w-full justify-center items-center">
            <input hidden name="nodeid" type="text" value={nodeId} readOnly />
            <input hidden name="interval" type="text" value={JSON.stringify(selectCyclicValues)} readOnly />
            <input hidden name="oncode" type="text" value={JSON.stringify(updateOncode)} readOnly />
            <input hidden name="sheet_data" type="text" value={JSON.stringify(data)} readOnly />
            <input hidden name="timefrom" type="text" value={JSON.stringify(timeFrom)} readOnly />
            <input hidden name="timeto" type="text" value={JSON.stringify(timeTo)} readOnly />
            <Button type="submit">Create XML</Button>
          </Form>
        </div>
      )}
    </main>
  );
}
